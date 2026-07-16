package utils

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/smtp"
)

const (
	smtpHost     = "smtp.gmail.com"
	smtpPort     = "465"
	smtpEmail    = "fx.fanady@gmail.com"
	smtpPassword = "psil rrrg kelt qxwg"
)

// SendEmail sends a raw HTML email via SSL/TLS on port 465
func SendEmail(to, subject, body string) error {
	header := make(map[string]string)
	header["From"] = "SIGAP JALAN <" + smtpEmail + ">"
	header["To"] = to
	header["Subject"] = subject
	header["MIME-Version"] = "1.0"
	header["Content-Type"] = "text/html; charset=UTF-8"

	message := ""
	for k, v := range header {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + body

	tlsConfig := &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         smtpHost,
	}

	conn, err := tls.Dial("tcp", smtpHost+":"+smtpPort, tlsConfig)
	if err != nil {
		return fmt.Errorf("tls dial failed: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, smtpHost)
	if err != nil {
		return fmt.Errorf("smtp client creation failed: %w", err)
	}
	defer client.Quit()

	auth := smtp.PlainAuth("", smtpEmail, smtpPassword, smtpHost)
	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("smtp authentication failed: %w", err)
	}

	if err = client.Mail(smtpEmail); err != nil {
		return fmt.Errorf("smtp mail command failed: %w", err)
	}
	if err = client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt command failed: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data command failed: %w", err)
	}
	defer w.Close()

	_, err = w.Write([]byte(message))
	if err != nil {
		return fmt.Errorf("smtp data write failed: %w", err)
	}

	return nil
}

// SendReceiptEmail sends a confirmation to the reporter when they submit a report
func SendReceiptEmail(to, reporterName, location string) {
	subject := "Tanda Terima Laporan SIGAP JALAN"
	body := fmt.Sprintf(`
		<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #E6EAF0; border-radius: 12px;">
			<h2 style="color: #1769E0;">SIGAP JALAN</h2>
			<p>Halo, <strong>%s</strong>,</p>
			<p>Terima kasih telah melaporkan jalan berlubang/rusak melalui platform SIGAP JALAN. Kami telah menerima laporan Anda.</p>
			<hr style="border: none; border-top: 1px solid #E6EAF0; margin: 20px 0;" />
			<p><strong>Detail Laporan:</strong></p>
			<ul>
				<li><strong>Lokasi:</strong> %s</li>
				<li><strong>Status Awal:</strong> MENUNGGU VERIFIKASI</li>
			</ul>
			<p>Laporan Anda akan ditinjau oleh staf Support kami sebelum dijadwalkan untuk perbaikan oleh tim Maintenance Engineering (ME).</p>
			<p>Kami akan mengirimkan pembaruan melalui email ini apabila status pengerjaan telah berubah.</p>
			<br />
			<p style="font-size: 12px; color: #667085;">Ini adalah email otomatis dari platform SIGAP JALAN. Harap tidak membalas email ini.</p>
		</div>
	`, reporterName, location)

	go func() {
		err := SendEmail(to, subject, body)
		if err != nil {
			log.Printf("ERROR (mailer): failed to send receipt email to %s: %v", to, err)
		} else {
			log.Printf("INFO (mailer): receipt email sent to %s successfully", to)
		}
	}()
}

// SendUpdateEmail sends an alert to the reporter when their report status updates
func SendUpdateEmail(to, reporterName, location string, oldStatus, newStatus string) {
	statusIndo := map[string]string{
		"MENUNGGU_VERIFIKASI": "Menunggu Verifikasi",
		"DIJADWALKAN":          "Dijadwalkan (Proses)",
		"SELESAI":              "Selesai (Diperbaiki)",
	}

	oldStr := statusIndo[oldStatus]
	if oldStr == "" {
		oldStr = oldStatus
	}
	newStr := statusIndo[newStatus]
	if newStr == "" {
		newStr = newStatus
	}

	subject := "Pembaruan Status Laporan SIGAP JALAN"
	body := fmt.Sprintf(`
		<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #E6EAF0; border-radius: 12px;">
			<h2 style="color: #1769E0;">SIGAP JALAN</h2>
			<p>Halo, <strong>%s</strong>,</p>
			<p>Laporan jalan berlubang/rusak yang Anda kirimkan telah diperbarui oleh tim kami.</p>
			<hr style="border: none; border-top: 1px solid #E6EAF0; margin: 20px 0;" />
			<p><strong>Detail Perubahan:</strong></p>
			<ul>
				<li><strong>Lokasi:</strong> %s</li>
				<li><strong>Status Sebelumnya:</strong> <span style="color: #B7791F;">%s</span></li>
				<li><strong>Status Terbaru:</strong> <strong style="color: #14804A;">%s</strong></li>
			</ul>
			<p>Terima kasih atas partisipasi Anda dalam membantu menjaga keselamatan lalu lintas jalan raya.</p>
			<br />
			<p style="font-size: 12px; color: #667085;">Ini adalah email otomatis dari platform SIGAP JALAN. Harap tidak membalas email ini.</p>
		</div>
	`, reporterName, location, oldStr, newStr)

	go func() {
		err := SendEmail(to, subject, body)
		if err != nil {
			log.Printf("ERROR (mailer): failed to send status update email to %s: %v", to, err)
		} else {
			log.Printf("INFO (mailer): status update email sent to %s successfully", to)
		}
	}()
}
