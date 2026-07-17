package seeder

import (
	"sigap-jalan-backend/internal/models"
	"time"

	"gorm.io/gorm"
)

func SeedReports(db *gorm.DB) error {
	var count int64
	if err := db.Model(&models.Report{}).Count(&count).Error; err != nil {
		return err
	}

	// Only seed if reports table is empty
	if count > 0 {
		return nil
	}

	// Tiny 1x1 transparent GIF placeholder bytes for the photo
	placeholderPhoto := []byte{
		0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 
		0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 
		0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 
		0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
	}

	now := time.Now()

	reports := []models.Report{
		{
			UID:          "PTH001",
			Location:     "Jl. Raya Pagedangan, dekat Foresta BSD",
			Latitude:     -6.2925,
			Longitude:    106.6432,
			Description:  "Lubang jalan sangat parah lebar 60cm, kedalaman 8cm, sering membuat pengendara motor terjatuh.",
			ReporterName: "Budi Santoso",
			ReporterEmail: "budi@email.com",
			Photo:        placeholderPhoto,
			Source:       models.SourceCitizen,
			Status:       models.StatusMenunggu,
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			UID:          "PTH002",
			Location:     "Jl. BSD Grand Boulevard",
			Latitude:     -6.2975,
			Longitude:    106.6415,
			Description:  "Terdapat 2 lubang berurutan berpotensi membahayakan ban mobil saat malam hari.",
			ReporterName: "Siti Rahma",
			ReporterEmail: "siti@email.com",
			Photo:        placeholderPhoto,
			Source:       models.SourceSystem,
			Status:       models.StatusDijadwalkan,
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			UID:          "PTH003",
			Location:     "Akses dekat Astra Biz Center BSD",
			Latitude:     -6.2875,
			Longitude:    106.6532,
			Description:  "Lubang air sedalam 10cm tertutup genangan air saat hujan.",
			ReporterName: "Hendra Wijaya",
			ReporterEmail: "hendra@email.com",
			Photo:        placeholderPhoto,
			Source:       models.SourceCitizen,
			Status:       models.StatusSelesai, // Ini sudah selesai, tidak boleh muncul di peta navigasi
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			UID:          "PTH004",
			Location:     "Jl. BSD Boulevard Utara, dekat lampu merah",
			Latitude:     -6.2845,
			Longitude:    106.6495,
			Description:  "Retakan jalan memanjang disertai lubang aspal terkelupas selebar 40cm.",
			ReporterName: "Sistem Sensor",
			ReporterEmail: "sensor@system.com",
			Photo:        placeholderPhoto,
			Source:       models.SourceSystem,
			Status:       models.StatusMenunggu,
			CreatedAt:    now,
			UpdatedAt:    now,
		},
	}

	for _, r := range reports {
		if err := db.Create(&r).Error; err != nil {
			return err
		}
	}

	return nil
}
