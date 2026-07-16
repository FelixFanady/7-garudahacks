package controllers

import (
	"errors"
	"io"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"sigap-jalan-backend/internal/models"
	"sigap-jalan-backend/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ReportController struct {
	db *gorm.DB
}

func NewReportController(db *gorm.DB) *ReportController {
	return &ReportController{db: db}
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

	report := models.Report{
		UID:           generateReportUID(h.db),
		Location:      location,
		Description:   description,
		ReporterName:  reporterName,
		ReporterEmail: reporterEmail,
		Photo:         photoBytes,
		Source:        models.SourceCitizen,
		Status:        models.StatusMenunggu,
	}

	if err := h.db.Create(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menyimpan laporan ke database"})
		return
	}

	// Send confirmation receipt to citizen
	utils.SendReceiptEmail(report.ReporterEmail, report.ReporterName, report.Location)

	c.JSON(http.StatusCreated, gin.H{
		"message": "laporan berhasil terkirim",
		"id":      report.ID,
	})
}

// CreateSystemReportPath handles mock pathways for Dashcam/System reports
func (h *ReportController) CreateSystemReportPath(c *gin.Context) {
	location := c.PostForm("location")
	description := c.PostForm("description")

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

	report := models.Report{
		UID:         generateReportUID(h.db),
		Location:    location,
		Description: description,
		Photo:       photoBytes,
		Source:      models.SourceSystem,
		Status:      models.StatusMenunggu,
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
		"id":               report.ID,
		"uid":              report.UID,
		"location":         report.Location,
		"description":      report.Description,
		"photo":            report.Photo,
		"source":           report.Source,
		"status":           report.Status,
		"scheduled_date":   report.ScheduledDate,
		"assigned_me_count": len(report.AssignedME),
		"created_at":       report.CreatedAt,
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
