package seeder

import (
	"sigap-jalan-backend/internal/config"
	"sigap-jalan-backend/internal/models"
	"sigap-jalan-backend/internal/utils"

	"gorm.io/gorm"
)

func SeedAdmin(db *gorm.DB, cfg config.Config) error {
	var count int64
	if err := db.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		return nil
	}

	hashedPassword, err := utils.HashPassword(cfg.SeedAdminPassword)
	if err != nil {
		return err
	}

	admin := models.User{
		Email:    cfg.SeedAdminEmail,
		Password: hashedPassword,
		Role:     models.RoleAdmin,
	}

	return db.Create(&admin).Error
}
