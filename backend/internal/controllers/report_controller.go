package controllers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/rand"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"

	"sigap-jalan-backend/internal/config"
	"sigap-jalan-backend/internal/models"
	"sigap-jalan-backend/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ReportController struct {
	db  *gorm.DB
	cfg config.Config
}

func NewReportController(db *gorm.DB, cfg config.Config) *ReportController {
	return &ReportController{db: db, cfg: cfg}
}

func generateReportUID(db *gorm.DB) string {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	const digits = "0123456789"

	for {
		b := make([]byte, 6)
		for i := 0; i < 3; i++ {
			b[i] = letters[r.Intn(len(letters))]
		}
		for i := 3; i < 6; i++ {
			b[i] = digits[r.Intn(len(digits))]
		}
		uid := string(b)

		var count int64
		db.Model(&models.Report{}).Where("uid = ?", uid).Count(&count)
		if count == 0 {
			return uid
		}
	}
}

// CreateCitizenReport parses public citizen multipart form-data.
func (h *ReportController) CreateCitizenReport(c *gin.Context) {
	location := c.PostForm("location")
	description := c.PostForm("description")
	reporterName := c.PostForm("reporter_name")
	reporterEmail := c.PostForm("reporter_email")
	latitudeStr := c.PostForm("latitude")
	longitudeStr := c.PostForm("longitude")

	var latitude, longitude float64
	if latitudeStr != "" {
		latitude, _ = strconv.ParseFloat(latitudeStr, 64)
	}
	if longitudeStr != "" {
		longitude, _ = strconv.ParseFloat(longitudeStr, 64)
	}

	if location == "" || description == "" || reporterName == "" || reporterEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nama, email, lokasi, dan laporan wajib diisi"})
		return
	}

	file, err := c.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "foto bukti jalan rusak wajib diunggah"})
		return
	}

	fileReader, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membuka file foto"})
		return
	}
	defer fileReader.Close()

	photoBytes, err := io.ReadAll(fileReader)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membaca file foto"})
		return
	}

	// Analisis gambar menggunakan AI microservice
	var assignedMEs []models.User
	isAutoVerified := false
	scheduledDate := time.Now().AddDate(0, 1, 0) // 1 bulan dari sekarang
	var reportStatus models.ReportStatus = models.StatusMenunggu

	detectionsCount, annotatedBytes, err := h.CallAIBackend(photoBytes)
	if err != nil {
		log.Printf("[AI Integration] Warning: Gagal menghubungi AI Backend: %v", err)
	} else if detectionsCount > 0 {
		log.Printf("[AI Integration] Success: Terdeteksi %d lubang pada laporan masyarakat (Auto-Verified)", detectionsCount)
		photoBytes = annotatedBytes
		description = fmt.Sprintf("[AI Auto-Verified: %d lubang terdeteksi]\n%s", detectionsCount, description)
		isAutoVerified = true

		// Query ME yang aktif (tidak diblokir) dan urutkan berdasarkan jumlah tugas yang belum selesai (status != SELESAI)
		type MEWithCount struct {
			models.User
			UnfinishedCount int `gorm:"column:unfinished_count"`
		}
		var activeMECounts []MEWithCount

		err := h.db.Model(&models.User{}).
			Select("users.*, COUNT(reports.id) as unfinished_count").
			Joins("LEFT JOIN report_assigned_me ON report_assigned_me.user_id = users.id").
			Joins("LEFT JOIN reports ON reports.id = report_assigned_me.report_id AND reports.status != ?", models.StatusSelesai).
			Where("users.role = ? AND users.is_banned = ?", models.RoleME, false).
			Group("users.id").
			Order("COUNT(reports.id) ASC, users.id ASC").
			Find(&activeMECounts).Error

		if err == nil && len(activeMECounts) > 0 {
			// Saring ME yang tidak terlalu sibuk (misalnya unfinished_count < 5)
			const maxTasksThreshold = 5
			var availableMEs []models.User
			for _, me := range activeMECounts {
				if me.UnfinishedCount < maxTasksThreshold {
					availableMEs = append(availableMEs, me.User)
				}
			}

			if len(availableMEs) > 0 {
				// Tentukan jumlah ME yang dialokasikan berdasarkan keparahan
				meToAssignCount := 1
				if detectionsCount >= 3 {
					// Jika parah (>= 3 lubang), alokasikan 3 ME jika slot tersedia
					meToAssignCount = 3
					if len(availableMEs) < 3 {
						meToAssignCount = len(availableMEs)
					}
				}
				assignedMEs = availableMEs[:meToAssignCount]
				reportStatus = models.StatusDijadwalkan
			} else {
				log.Printf("[AI Integration] Warning: Semua staf ME sedang sibuk (tugas >= %d). Alihkan ke manual.", maxTasksThreshold)
				isAutoVerified = false
			}
		} else {
			log.Printf("[AI Integration] Warning: Gagal query staf ME atau tidak ada staf ME aktif. Alihkan ke manual: %v", err)
			isAutoVerified = false
		}
	} else {
		log.Printf("[AI Integration] Info: Tidak terdeteksi lubang (0 lubang) pada laporan masyarakat")
	}

	var report models.Report
	if isAutoVerified {
		report = models.Report{
			UID:           generateReportUID(h.db),
			Location:      location,
			Latitude:      latitude,
			Longitude:     longitude,
			Description:   description,
			ReporterName:  reporterName,
			ReporterEmail: reporterEmail,
			Photo:         photoBytes,
			Source:        models.SourceCitizen,
			Status:        reportStatus,
			ScheduledDate: &scheduledDate,
			IsFalseReport: false,
		}
	} else {
		report = models.Report{
			UID:           generateReportUID(h.db),
			Location:      location,
			Latitude:      latitude,
			Longitude:     longitude,
			Description:   description,
			ReporterName:  reporterName,
			ReporterEmail: reporterEmail,
			Photo:         photoBytes,
			Source:        models.SourceCitizen,
			Status:        reportStatus,
			IsFalseReport: false,
		}
	}

	if err := h.db.Create(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menyimpan laporan ke database"})
		return
	}

	// Jika auto-verified dan ada ME yang ditugaskan, hubungkan many-to-many
	if isAutoVerified && len(assignedMEs) > 0 {
		if err := h.db.Model(&report).Association("AssignedME").Replace(&assignedMEs); err != nil {
			log.Printf("[AI Integration] Warning: Gagal mengaitkan ME: %v", err)
		}
	}

	// Send confirmation receipt to citizen
	utils.SendReceiptEmail(report.ReporterEmail, report.ReporterName, report.Location)

	// Persiapkan response message
	responseMessage := "Laporan berhasil dikirim dan sedang diproses."

	c.JSON(http.StatusCreated, gin.H{
		"message": responseMessage,
		"id":      report.ID,
	})
}

// CreateSystemReportPath handles mock pathways for Dashcam/System reports
func (h *ReportController) CreateSystemReportPath(c *gin.Context) {
	location := c.PostForm("location")
	description := c.PostForm("description")
	latitudeStr := c.PostForm("latitude")
	longitudeStr := c.PostForm("longitude")

	var latitude, longitude float64
	if latitudeStr != "" {
		latitude, _ = strconv.ParseFloat(latitudeStr, 64)
	}
	if longitudeStr != "" {
		longitude, _ = strconv.ParseFloat(longitudeStr, 64)
	}

	if location == "" || description == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "lokasi dan deskripsi sistem wajib diisi"})
		return
	}

	file, err := c.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "foto bukti wajib diunggah"})
		return
	}

	fileReader, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membuka file foto"})
		return
	}
	defer fileReader.Close()

	photoBytes, err := io.ReadAll(fileReader)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membaca file foto"})
		return
	}

	// Analisis gambar menggunakan AI microservice
	isFalseReport := false
	detectionsCount, annotatedBytes, err := h.CallAIBackend(photoBytes)
	if err != nil {
		log.Printf("[AI Integration] Warning: Gagal menghubungi AI Backend: %v", err)
	} else {
		log.Printf("[AI Integration] Success: Terdeteksi %d lubang pada laporan sistem", detectionsCount)
		photoBytes = annotatedBytes
		description = fmt.Sprintf("[AI Detection: %d lubang terdeteksi]\n%s", detectionsCount, description)
		if detectionsCount == 0 {
			isFalseReport = true
		}
	}

	report := models.Report{
		UID:           generateReportUID(h.db),
		Location:      location,
		Latitude:      latitude,
		Longitude:     longitude,
		Description:   description,
		Photo:         photoBytes,
		Source:        models.SourceSystem,
		Status:        models.StatusMenunggu,
		IsFalseReport: isFalseReport,
	}

	if err := h.db.Create(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menyimpan laporan sistem ke database"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "laporan sistem berhasil diterima",
		"id":      report.ID,
	})
}

// GetReportDetails fetches a report with its comments
func (h *ReportController) GetReportDetails(c *gin.Context) {
	id := c.Param("id")

	var report models.Report
	query := h.db.Preload("AssignedME")
	if idVal, err := strconv.Atoi(id); err == nil {
		query = query.Where("uid = ? OR id = ?", id, idVal)
	} else {
		query = query.Where("uid = ?", id)
	}

	if err := query.First(&report).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "laporan tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat detail laporan"})
		return
	}

	var comments []models.Comment
	if err := h.db.Preload("Sender").Where("report_id = ?", report.ID).Order("created_at asc").Find(&comments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat komentar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"report":   report,
		"comments": comments,
	})
}

// AddReportComment posts a new comment with optional photo
func (h *ReportController) AddReportComment(c *gin.Context) {
	reportUIDOrID := c.Param("id")
	message := c.PostForm("message")
	isProof := c.PostForm("is_proof") == "true"

	var report models.Report
	query := h.db
	if idVal, err := strconv.Atoi(reportUIDOrID); err == nil {
		query = query.Where("uid = ? OR id = ?", reportUIDOrID, idVal)
	} else {
		query = query.Where("uid = ?", reportUIDOrID)
	}

	if err := query.First(&report).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "laporan tidak ditemukan"})
		return
	}

	authUserVal, exists := c.Get("authUser")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	user := authUserVal.(models.User)

	var photoBytes []byte
	file, err := c.FormFile("photo")
	if err == nil {
		fileReader, err := file.Open()
		if err == nil {
			photoBytes, _ = io.ReadAll(fileReader)
			fileReader.Close()
		}
	}

	if message == "" && len(photoBytes) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "pesan atau foto wajib diisi"})
		return
	}

	comment := models.Comment{
		ReportID:  report.ID,
		SenderID:  user.ID,
		Message:   message,
		Photo:     photoBytes,
		IsProof:   isProof,
		CreatedAt: time.Now(),
	}

	if err := h.db.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal mengirim komentar"})
		return
	}

	if isProof {
		oldStatus := report.Status
		report.Status = models.StatusSelesai
		h.db.Save(&report)

		if report.Source == models.SourceCitizen && report.ReporterEmail != "" {
			utils.SendUpdateEmail(report.ReporterEmail, report.ReporterName, report.Location, string(oldStatus), string(models.StatusSelesai))
		}
	}

	// Preload sender to return in response
	h.db.Preload("Sender").First(&comment, comment.ID)

	c.JSON(http.StatusCreated, comment)
}

// ListAllReports returns all reports for Support overview
func (h *ReportController) ListAllReports(c *gin.Context) {
	var reports []models.Report
	if err := h.db.Preload("AssignedME").Order("created_at desc").Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat daftar laporan"})
		return
	}
	c.JSON(http.StatusOK, reports)
}

// scheduleRequest holds scheduled inputs
type scheduleRequest struct {
	AssignedMEIDs []uint `json:"assigned_me_ids" binding:"required"`
	ScheduledDate string `json:"scheduled_date" binding:"required"`
}

// ScheduleReport schedules and assigns report to ME staff
func (h *ReportController) ScheduleReport(c *gin.Context) {
	id := c.Param("id")
	var req scheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "assigned_me_ids dan scheduled_date wajib diisi"})
		return
	}

	parsedDate, err := time.Parse(time.RFC3339, req.ScheduledDate)
	if err != nil {
		parsedDate, err = time.Parse("2006-01-02", req.ScheduledDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "format tanggal tidak valid, gunakan YYYY-MM-DD atau RFC3339"})
			return
		}
	}

	// Pastikan tanggal pengerjaan tidak boleh hari sebelumnya
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	targetDate := time.Date(parsedDate.Year(), parsedDate.Month(), parsedDate.Day(), 0, 0, 0, 0, now.Location())
	if targetDate.Before(today) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tanggal pengerjaan tidak boleh hari sebelumnya"})
		return
	}

	var meUsers []models.User
	if err := h.db.Where("id IN ? AND role = ? AND is_banned = ?", req.AssignedMEIDs, models.RoleME, false).Find(&meUsers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat data staf ME"})
		return
	}

	if len(meUsers) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "staf ME tidak ditemukan atau dinonaktifkan"})
		return
	}

	var report models.Report
	query := h.db
	if idVal, err := strconv.Atoi(id); err == nil {
		query = query.Where("uid = ? OR id = ?", id, idVal)
	} else {
		query = query.Where("uid = ?", id)
	}

	if err := query.First(&report).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "laporan tidak ditemukan"})
		return
	}

	oldStatus := report.Status
	report.ScheduledDate = &parsedDate
	report.Status = models.StatusDijadwalkan

	if err := h.db.Save(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menjadwalkan perbaikan"})
		return
	}

	// Update GORM many-to-many association
	if err := h.db.Model(&report).Association("AssignedME").Replace(&meUsers); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal mengupdate penugasan ME"})
		return
	}

	// Preload the newly assigned ME staff to return in response
	h.db.Preload("AssignedME").First(&report, report.ID)

	// Trigger status update email if source is citizen and email is provided
	if report.Source == models.SourceCitizen && report.ReporterEmail != "" {
		utils.SendUpdateEmail(report.ReporterEmail, report.ReporterName, report.Location, string(oldStatus), string(models.StatusDijadwalkan))
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "perbaikan berhasil dijadwalkan dan ditugaskan ke ME",
		"report":  report,
	})
}

// CancelScheduleReport cancels the schedule and ME assignment for a report marked as false report
func (h *ReportController) CancelScheduleReport(c *gin.Context) {
	reportUIDOrID := c.Param("id")

	var report models.Report
	query := h.db.Preload("AssignedME")
	if idVal, err := strconv.Atoi(reportUIDOrID); err == nil {
		query = query.Where("uid = ? OR id = ?", reportUIDOrID, idVal)
	} else {
		query = query.Where("uid = ?", reportUIDOrID)
	}

	if err := query.First(&report).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "laporan tidak ditemukan"})
		return
	}

	if !report.IsFalseReport {
		c.JSON(http.StatusBadRequest, gin.H{"error": "penugasan hanya dapat dibatalkan jika laporan ditandai sebagai laporan palsu (false report)"})
		return
	}

	oldStatus := report.Status
	report.Status = models.StatusMenunggu
	report.ScheduledDate = nil

	if err := h.db.Save(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membatalkan jadwal perbaikan"})
		return
	}

	if err := h.db.Model(&report).Association("AssignedME").Clear(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menghapus penugasan ME"})
		return
	}

	// Fetch updated report
	h.db.Preload("AssignedME").First(&report, report.ID)

	// Trigger status update email if source is citizen and email is provided
	if report.Source == models.SourceCitizen && report.ReporterEmail != "" {
		utils.SendUpdateEmail(report.ReporterEmail, report.ReporterName, report.Location, string(oldStatus), string(models.StatusMenunggu))
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "penugasan ME berhasil dibatalkan",
		"report":  report,
	})
}


// ListMESkills returns all active ME staff members for the dropdown
func (h *ReportController) ListMESkills(c *gin.Context) {
	var users []models.User
	if err := h.db.Where("role = ? AND is_banned = ?", models.RoleME, false).Order("email asc").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat daftar staf ME"})
		return
	}
	c.JSON(http.StatusOK, users)
}

// ListMyTasks lists tasks assigned to the authenticated ME staff
func (h *ReportController) ListMyTasks(c *gin.Context) {
	authUserVal, exists := c.Get("authUser")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	user := authUserVal.(models.User)

	var reports []models.Report
	if err := h.db.Joins("JOIN report_assigned_me ON report_assigned_me.report_id = reports.id").
		Where("report_assigned_me.user_id = ?", user.ID).
		Order("scheduled_date asc").
		Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat tugas ME"})
		return
	}
	c.JSON(http.StatusOK, reports)
}

// UpdateTaskStatus completes a task
func (h *ReportController) UpdateTaskStatus(c *gin.Context) {
	id := c.Param("id")

	var report models.Report
	query := h.db
	if idVal, err := strconv.Atoi(id); err == nil {
		query = query.Where("uid = ? OR id = ?", id, idVal)
	} else {
		query = query.Where("uid = ?", id)
	}

	if err := query.First(&report).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "laporan tidak ditemukan"})
		return
	}

	oldStatus := report.Status
	report.Status = models.StatusSelesai

	if err := h.db.Save(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal mengupdate status tugas"})
		return
	}

	if report.Source == models.SourceCitizen && report.ReporterEmail != "" {
		utils.SendUpdateEmail(report.ReporterEmail, report.ReporterName, report.Location, string(oldStatus), string(models.StatusSelesai))
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "tugas berhasil diselesaikan",
		"report":  report,
	})
}

// publicReportResponse is a subset of Report model for public consumption (hides reporter info)
type publicReportResponse struct {
	ID            uint       `json:"id"`
	UID           string     `json:"uid"`
	Location      string     `json:"location"`
	Latitude      float64    `json:"latitude"`
	Longitude     float64    `json:"longitude"`
	Description   string     `json:"description"`
	Photo         []byte     `json:"photo"`
	Source        string     `json:"source"`
	Status        string     `json:"status"`
	ScheduledDate *time.Time `json:"scheduled_date"`
	CreatedAt     time.Time  `json:"created_at"`
}

// ListPublicReports lists all reports publicly (without exposing reporter name/email)
func (h *ReportController) ListPublicReports(c *gin.Context) {
	var reports []models.Report
	if err := h.db.Where("is_false_report = ?", false).Order("created_at desc").Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat daftar laporan publik"})
		return
	}

	publicReports := make([]publicReportResponse, 0, len(reports))
	for _, r := range reports {
		publicReports = append(publicReports, publicReportResponse{
			ID:            r.ID,
			UID:           r.UID,
			Location:      r.Location,
			Latitude:      r.Latitude,
			Longitude:     r.Longitude,
			Description:   r.Description,
			Photo:         r.Photo,
			Source:        string(r.Source),
			Status:        string(r.Status),
			ScheduledDate: r.ScheduledDate,
			CreatedAt:     r.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, publicReports)
}

// GetPublicReportDetails fetches a report details and comments publicly (hides reporter info)
func (h *ReportController) GetPublicReportDetails(c *gin.Context) {
	id := c.Param("id")

	var report models.Report
	query := h.db.Preload("AssignedME")
	if idVal, err := strconv.Atoi(id); err == nil {
		query = query.Where("uid = ? OR id = ?", id, idVal)
	} else {
		query = query.Where("uid = ?", id)
	}

	if err := query.First(&report).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "laporan tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat detail laporan"})
		return
	}

	// Block access to false reports from public view
	if report.IsFalseReport {
		c.JSON(http.StatusNotFound, gin.H{"error": "laporan tidak ditemukan"})
		return
	}

	var comments []models.Comment
	if err := h.db.Preload("Sender").Where("report_id = ?", report.ID).Order("created_at asc").Find(&comments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat komentar"})
		return
	}

	// Sanitize report reporter credentials for public transparency
	sanitizedReport := gin.H{
		"id":                report.ID,
		"uid":               report.UID,
		"location":          report.Location,
		"latitude":          report.Latitude,
		"longitude":         report.Longitude,
		"description":       report.Description,
		"photo":             report.Photo,
		"source":            report.Source,
		"status":            report.Status,
		"scheduled_date":    report.ScheduledDate,
		"assigned_me_count": len(report.AssignedME),
		"created_at":        report.CreatedAt,
	}

	// Sanitize comment sender info: only expose role, never email or other PII
	type publicSender struct {
		Role string `json:"role"`
	}
	type publicComment struct {
		ID           uint         `json:"id"`
		Message      string       `json:"message"`
		Photo        []byte       `json:"photo"`
		IsProof      bool         `json:"is_proof"`
		IsFinalProof bool         `json:"is_final_proof"`
		CreatedAt    string       `json:"created_at"`
		Sender       publicSender `json:"sender"`
	}

	sanitizedComments := make([]publicComment, 0, len(comments))
	for _, c := range comments {
		sanitizedComments = append(sanitizedComments, publicComment{
			ID:           c.ID,
			Message:      c.Message,
			Photo:        c.Photo,
			IsProof:      c.IsProof,
			IsFinalProof: c.IsFinalProof,
			CreatedAt:    c.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			Sender: publicSender{
				Role: string(c.Sender.Role),
			},
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"report":   sanitizedReport,
		"comments": sanitizedComments,
	})
}

// SetCommentFinalProof toggles a comment as final proof of the report
func (h *ReportController) SetCommentFinalProof(c *gin.Context) {
	reportUIDOrID := c.Param("id")
	commentIDStr := c.Param("comment_id")

	commentID, err := strconv.Atoi(commentIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID komentar tidak valid"})
		return
	}

	var report models.Report
	query := h.db
	if idVal, err := strconv.Atoi(reportUIDOrID); err == nil {
		query = query.Where("uid = ? OR id = ?", reportUIDOrID, idVal)
	} else {
		query = query.Where("uid = ?", reportUIDOrID)
	}

	if err := query.First(&report).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "laporan tidak ditemukan"})
		return
	}

	authUserVal, exists := c.Get("authUser")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	user := authUserVal.(models.User)

	if user.Role != models.RoleME && user.Role != models.RoleSupport && user.Role != models.RoleAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "hanya ME, Support atau Admin yang dapat menetapkan bukti final"})
		return
	}

	var comment models.Comment
	if err := h.db.Where("id = ? AND report_id = ?", commentID, report.ID).First(&comment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "komentar tidak ditemukan"})
		return
	}

	// Toggle logic
	newStatus := !comment.IsFinalProof

	tx := h.db.Begin()
	if newStatus {
		// Set all other comments of this report to false
		if err := tx.Model(&models.Comment{}).Where("report_id = ?", report.ID).Update("is_final_proof", false).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memperbarui komentar lain"})
			return
		}

		// Update report status to SELESAI
		oldStatus := report.Status
		report.Status = models.StatusSelesai
		if err := tx.Save(&report).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal mengupdate status laporan"})
			return
		}

		if report.Source == models.SourceCitizen && report.ReporterEmail != "" {
			utils.SendUpdateEmail(report.ReporterEmail, report.ReporterName, report.Location, string(oldStatus), string(models.StatusSelesai))
		}
	} else {
		// Revert report status to DIJADWALKAN
		oldStatus := report.Status
		report.Status = models.StatusDijadwalkan
		if err := tx.Save(&report).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal mengupdate status laporan"})
			return
		}

		if report.Source == models.SourceCitizen && report.ReporterEmail != "" {
			utils.SendUpdateEmail(report.ReporterEmail, report.ReporterName, report.Location, string(oldStatus), string(models.StatusDijadwalkan))
		}
	}

	if err := tx.Model(&comment).Update("is_final_proof", newStatus).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memperbarui bukti final"})
		return
	}
	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message":        "Status bukti final berhasil diperbarui",
		"comment_id":     comment.ID,
		"is_final_proof": newStatus,
	})
}

// ToggleFalseReport lets Support/Admin mark or unmark a report as false (hides it from public)
func (h *ReportController) ToggleFalseReport(c *gin.Context) {
	reportUIDOrID := c.Param("id")

	var report models.Report
	query := h.db
	if idVal, err := strconv.Atoi(reportUIDOrID); err == nil {
		query = query.Where("uid = ? OR id = ?", reportUIDOrID, idVal)
	} else {
		query = query.Where("uid = ?", reportUIDOrID)
	}

	if err := query.First(&report).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "laporan tidak ditemukan"})
		return
	}

	newVal := !report.IsFalseReport
	if err := h.db.Model(&report).Update("is_false_report", newVal).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memperbarui status laporan"})
		return
	}

	msg := "Laporan ditandai sebagai laporan palsu dan disembunyikan dari transparansi publik."
	if !newVal {
		msg = "Laporan dipulihkan dan kembali tampil di transparansi publik."
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         msg,
		"is_false_report": newVal,
	})
}

type AIDetectionResponse struct {
	Detections int    `json:"detections"`
	Image      string `json:"image"` // base64 data URI
	Error      string `json:"error"`
}

// CallAIBackend mengirimkan foto ke server AI microservice dan mengembalikan jumlah deteksi serta gambar hasil anotasi
func (h *ReportController) CallAIBackend(photoBytes []byte) (int, []byte, error) {
	if h.cfg.AIBackendURL == "" {
		return 0, nil, fmt.Errorf("AI_BACKEND_URL tidak dikonfigurasi")
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Membuat field file dengan nama parameter "file"
	part, err := writer.CreateFormFile("file", "image.jpg")
	if err != nil {
		return 0, nil, fmt.Errorf("gagal membuat form file: %w", err)
	}
	if _, err := io.Copy(part, bytes.NewReader(photoBytes)); err != nil {
		return 0, nil, fmt.Errorf("gagal menyalin file bytes: %w", err)
	}

	// Menambahkan parameter conf default "0.10"
	if err := writer.WriteField("conf", "0.10"); err != nil {
		return 0, nil, fmt.Errorf("gagal menulis field conf: %w", err)
	}

	if err := writer.Close(); err != nil {
		return 0, nil, fmt.Errorf("gagal menutup writer: %w", err)
	}

	req, err := http.NewRequest("POST", h.cfg.AIBackendURL+"/upload_image", body)
	if err != nil {
		return 0, nil, fmt.Errorf("gagal membuat request HTTP: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("gagal melakukan request ke AI backend: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBodyBytes, _ := io.ReadAll(resp.Body)
		return 0, nil, fmt.Errorf("AI backend mengembalikan status non-OK: %d, body: %s", resp.StatusCode, string(respBodyBytes))
	}

	var aiResp AIDetectionResponse
	if err := json.NewDecoder(resp.Body).Decode(&aiResp); err != nil {
		return 0, nil, fmt.Errorf("gagal mendecode respon JSON AI: %w", err)
	}

	if aiResp.Error != "" {
		return 0, nil, fmt.Errorf("AI backend error: %s", aiResp.Error)
	}

	// Format base64 data:image/jpeg;base64,<data>
	prefix := "data:image/jpeg;base64,"
	if !strings.HasPrefix(aiResp.Image, prefix) {
		return aiResp.Detections, nil, fmt.Errorf("format gambar AI tidak valid (missing prefix)")
	}

	base64Data := aiResp.Image[len(prefix):]
	decodedImageBytes, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return aiResp.Detections, nil, fmt.Errorf("gagal mendecode base64 dari AI: %w", err)
	}

	return aiResp.Detections, decodedImageBytes, nil
}

// GetPublicStats returns reports and user statistics
func (h *ReportController) GetPublicStats(c *gin.Context) {
	var totalReports int64
	var workAreasCount int64
	var fieldStaffCount int64
	var armadaTeamsCount int64
	var completedRoadsCount int64

	// 1. Total reports (not false reports)
	if err := h.db.Model(&models.Report{}).Where("is_false_report = ?", false).Count(&totalReports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat statistik total laporan"})
		return
	}

	// 2. Work areas count (distinct locations from reports where not false reports)
	if err := h.db.Model(&models.Report{}).Where("is_false_report = ?", false).Distinct("location").Count(&workAreasCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat statistik wilayah kerja"})
		return
	}

	// 3. Field staff count (active ME users)
	if err := h.db.Model(&models.User{}).Where("role = ? AND is_banned = ?", models.RoleME, false).Count(&fieldStaffCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat statistik staf lapangan"})
		return
	}

	// 4. Armada teams count (active ME users currently assigned to at least one scheduled/waiting report)
	// We can find this by querying the report_assigned_me table for unique user_ids that are assigned to reports where is_false_report = false
	if err := h.db.Table("report_assigned_me").
		Joins("JOIN reports ON reports.id = report_assigned_me.report_id").
		Where("reports.is_false_report = ?", false).
		Distinct("report_assigned_me.user_id").
		Count(&armadaTeamsCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat statistik tim armada"})
		return
	}

	// 5. Completed roads count (reports with status finished and not false report)
	if err := h.db.Model(&models.Report{}).Where("status = ? AND is_false_report = ?", models.StatusSelesai, false).Count(&completedRoadsCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat statistik jalan selesai"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total_reports":   totalReports,
		"work_areas":      workAreasCount,
		"field_staff":     fieldStaffCount,
		"armada_teams":    armadaTeamsCount,
		"completed_roads": completedRoadsCount,
	})
}

