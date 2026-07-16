package models

import "time"

type Role string

const (
	RoleAdmin   Role = "ADMIN"
	RoleME      Role = "ME"
	RoleSupport Role = "SUPPORT"
)

type User struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Email     string    `json:"email" gorm:"type:varchar(255);uniqueIndex;not null"`
	Password  string    `json:"-" gorm:"type:varchar(255);not null"`
	Role      Role      `json:"role" gorm:"type:varchar(20);not null"`
	IsBanned  bool      `json:"is_banned" gorm:"default:false;not null"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func IsValidRole(role Role) bool {
	return role == RoleAdmin || role == RoleME || role == RoleSupport
}
