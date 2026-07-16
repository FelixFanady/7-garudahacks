package database

import (
	"sigap-jalan-backend/internal/config"
	"sigap-jalan-backend/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Connect(cfg config.Config) (*gorm.DB, error) {
	return gorm.Open(postgres.Open(cfg.DatabaseDSN()), &gorm.Config{
		TranslateError: true,
	})
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(&models.User{}, &models.Report{}, &models.Comment{})
}