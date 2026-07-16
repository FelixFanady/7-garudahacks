package models

import "time"

type ReportStatus string

const (
	StatusMenunggu   ReportStatus = "MENUNGGU_VERIFIKASI"
	StatusDijadwalkan ReportStatus = "DIJADWALKAN"
	StatusSelesai     ReportStatus = "SELESAI"
)

type ReportSource string

const (
	SourceCitizen ReportSource = "CITIZEN"
	SourceSystem  ReportSource = "SYSTEM"
)

type Report struct {
	ID             uint         `json:"id" gorm:"primaryKey"`
	UID            string       `json:"uid" gorm:"type:varchar(6);uniqueIndex;not null"`
	Location       string       `json:"location" gorm:"type:varchar(255);not null"`
	Description    string       `json:"description" gorm:"type:text;not null"`
	ReporterName   string       `json:"reporter_name" gorm:"type:varchar(100)"`
	ReporterEmail  string       `json:"reporter_email" gorm:"type:varchar(255)"`
	Photo          []byte       `json:"photo" gorm:"type:bytea;not null"`
	Source         ReportSource `json:"source" gorm:"type:varchar(20);default:'CITIZEN';not null"`
	Status         ReportStatus `json:"status" gorm:"type:varchar(30);default:'MENUNGGU_VERIFIKASI';not null"`
	ScheduledDate  *time.Time   `json:"scheduled_date"`
	AssignedME     []User       `json:"assigned_me" gorm:"many2many:report_assigned_me;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	IsFalseReport  bool         `json:"is_false_report" gorm:"type:boolean;default:false;not null"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
}
