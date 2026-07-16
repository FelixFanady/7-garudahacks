package models

import "time"

type Comment struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	ReportID     uint      `json:"report_id" gorm:"not null"`
	SenderID     uint      `json:"sender_id" gorm:"not null"`
	Sender       User      `json:"sender" gorm:"foreignKey:SenderID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Message      string    `json:"message" gorm:"type:text;not null"`
	Photo        []byte    `json:"photo" gorm:"type:bytea"` // Optional proof photo in chat
	IsProof      bool      `json:"is_proof" gorm:"type:boolean;default:false;not null"`
	IsFinalProof bool      `json:"is_final_proof" gorm:"type:boolean;default:false;not null"`
	CreatedAt    time.Time `json:"created_at"`
}
