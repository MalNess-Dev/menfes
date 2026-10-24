import os
import sys
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and print 'Halaman X dari Y'
    along with running header and footer.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count):
        if self._pageNumber == 1:
            # Skip cover page
            return

        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#006569"))
        self.drawString(54, 802, "DAFTAR FITUR & ARSITEKTUR SISTEM INSTAGRAM MENFESS")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawRightString(558, 802, "SIMPLE IG MENFESS // OFFICIAL DOCS")

        self.setStrokeColor(colors.HexColor("#D4ECE4"))
        self.setLineWidth(1)
        self.line(54, 794, 558, 794)

        # Running Footer
        self.line(54, 45, 558, 45)
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(54, 32, "SISTEM ANONYMOUS MENFESS • BEBAS TANPA LOGIN • ANTI-SPAM SESSION • ENKRIPSI PENUH")
        page_text = f"Halaman {self._pageNumber} dari {page_count}"
        self.drawRightString(558, 32, page_text)
        self.restoreState()


def create_feature_list_pdf(output_filename="Daftar_Fitur_Dan_Sistem_Menfess.pdf"):
    doc = SimpleDocTemplate(
        output_filename,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Custom Project Palette
    PRIMARY = colors.HexColor("#006569")      # Pine Teal / Palette Primary
    SECONDARY = colors.HexColor("#008F94")    # Teal Bright
    ACCENT_MINT = colors.HexColor("#D4ECE4")  # Pastel Mint Sage
    ACCENT_ORANGE = colors.HexColor("#FF6433")# Orange Action
    DARK_BG = colors.HexColor("#0A1619")      # Dark Cyan
    TEXT_DARK = colors.HexColor("#0F172A")    # Slate 900
    TEXT_MUTED = colors.HexColor("#475569")   # Slate 600
    BG_LIGHT = colors.HexColor("#F8FAFC")     # Slate 50
    BORDER_LIGHT = colors.HexColor("#E2E8F0") # Slate 200
    SUCCESS_BG = colors.HexColor("#E6F4F1")   # Teal 50
    SUCCESS_BORDER = colors.HexColor("#99D1D4")

    # Typography Styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=PRIMARY,
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=16,
        textColor=TEXT_MUTED,
    )

    h1_style = ParagraphStyle(
        "Heading1_Custom",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=PRIMARY,
        spaceBefore=14,
        spaceAfter=6,
    )

    h2_style = ParagraphStyle(
        "Heading2_Custom",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=TEXT_DARK,
        spaceBefore=10,
        spaceAfter=4,
    )

    body_style = ParagraphStyle(
        "Body_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=14.5,
        textColor=TEXT_DARK,
    )

    body_muted = ParagraphStyle(
        "Body_Muted",
        parent=body_style,
        textColor=TEXT_MUTED,
    )

    code_style = ParagraphStyle(
        "CodeStyle",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#004D40"),
    )

    feature_title = ParagraphStyle(
        "FeatureTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=PRIMARY,
    )

    feature_desc = ParagraphStyle(
        "FeatureDesc",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13.5,
        textColor=TEXT_DARK,
    )

    story = []

    # =========================================================================
    # COVER / HEADER BANNER
    # =========================================================================
    badge_p = Paragraph(
        "<font color='#006569'><b>✦ RESMI &amp; TERVERIFIKASI</b></font> &nbsp;|&nbsp; <font color='#64748B'>Next.js 16 • SQLite WAL • Instagram Worker</font>",
        ParagraphStyle("Badge", parent=styles["Normal"], fontName="Helvetica", fontSize=9, textColor=PRIMARY)
    )
    story.append(badge_p)
    story.append(Spacer(1, 10))

    story.append(Paragraph("DAFTAR FITUR &amp; ARSITEKTUR UNJ MENFESS", title_style))
    story.append(Paragraph("Platform Confession Mahasiswa UNJ dengan Multi-Template Comic, Maskot Pure SVG Interaktif, dan Enkripsi Penuh", subtitle_style))
    story.append(Spacer(1, 14))

    # Info Summary Box
    summary_data = [
        [
            Paragraph("<b>Nama Platform:</b> UNJ Menfess (Kampus Hijau)", body_style),
            Paragraph("<b>Autentikasi:</b> Bebas Tanpa Login (Zero-Friction)", body_style),
        ],
        [
            Paragraph("<b>Pilihan Template:</b> Comic Pop-Art, UNJ Gold, Cyber, Scrapbook", body_style),
            Paragraph("<b>Maskot:</b> Pure Vector SVG (Draggable &amp; Interactive)", body_style),
        ],
        [
            Paragraph("<b>Anti-Spam:</b> Sesi Cookie &amp; IP Hash (3 pesan / 10 menit)", body_style),
            Paragraph("<b>Keamanan Data:</b> Salted HMAC-SHA256 (IP Terenkripsi)", body_style),
        ],
    ]
    summary_table = Table(summary_data, colWidths=[245, 245])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), SUCCESS_BG),
        ('BOX', (0, 0), (-1, -1), 1, SUCCESS_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#C4E4DD")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECTION 1: RINGKASAN DESAIN & KEBUTUHAN UTAMA
    # =========================================================================
    story.append(Paragraph("1. Ringkasan Desain &amp; Prinsip Penyederhanaan", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceAfter=8))

    p_intro = Paragraph(
        "Sesuai kebutuhan terbaru, sistem ini dirancang ulang dengan prinsip <b>kesederhanaan maksimal bagi pengguna dan pemilik</b>: "
        "menghapus keharusan registrasi/login akun, menghilangkan antarmuka admin yang berbelit-belit, meniadakan perintah CMD rumit "
        "untuk pengeditan data, namun <b>tetap mempertahankan pembatasan anti-spam berbasis session/IP dan enkripsi tingkat tinggi</b> "
        "agar konfigurasi rahasia (.env) dan privasi pemilik maupun pengirim tidak dapat dilacak atau bocor.",
        body_style
    )
    story.append(p_intro)
    story.append(Spacer(1, 12))

    # Core Principles Table
    principles_data = [
        [
            Paragraph("<b>Prinsip</b>", ParagraphStyle("TH", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white)),
            Paragraph("<b>Implementasi Nyata di Sistem</b>", ParagraphStyle("TH", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white)),
            Paragraph("<b>Manfaat Utama</b>", ParagraphStyle("TH", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white)),
        ],
        [
            Paragraph("<b>Bebas Kirim Tanpa Login</b>", feature_title),
            Paragraph("Form publik langsung terbuka. Pengirim tidak diminta password, username, atau email.", body_style),
            Paragraph("Konversi tinggi, mudah digunakan siapa saja tanpa halangan pendaftaran.", body_style),
        ],
        [
            Paragraph("<b>Session Anti-Spam Limiter</b>", feature_title),
            Paragraph("Menggunakan cookie sesi <code>menfess_session_id</code> &amp; IP hash. Kuota 3 pesan / 10 menit.", body_style),
            Paragraph("Mencegah bom pesan, bot spam, dan pengulangan kirim tanpa membebani user jujur.", body_style),
        ],
        [
            Paragraph("<b>Tanpa Panel Admin Rumit</b>", feature_title),
            Paragraph("Rute admin dan kontrol manual dieliminasi. Sistem berjalan 100% otomatis.", body_style),
            Paragraph("Nol risiko pembobolan halaman admin, tidak ada surface attack brute-force login.", body_style),
        ],
        [
            Paragraph("<b>Enkripsi &amp; Isolasi .env</b>", feature_title),
            Paragraph("Kredensial Instagram (.env) terisolasi. IP pengirim di-hash dengan HMAC-SHA256 salt rahasia.", body_style),
            Paragraph("Identitas pemilik web dan pengirim aman, data tidak bisa dibongkar tools dekripsi.", body_style),
        ],
    ]
    p_table = Table(principles_data, colWidths=[120, 230, 140])
    p_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('BOX', (0, 0), (-1, -1), 0.75, BORDER_LIGHT),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(p_table)
    story.append(Spacer(1, 16))

    # =========================================================================
    # SECTION 2: DAFTAR FITUR LENGKAP (FEATURE LIST)
    # =========================================================================
    story.append(Paragraph("2. Daftar Fitur Lengkap Aplikasi Menfess", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceAfter=8))

    features = [
        (
            "1. Pengiriman Menfess Anonim Bebas (Frictionless Posting)",
            "Pengguna dapat langsung membuka website dan mengetikkan pesan menfess tanpa registrasi, tanpa login, dan tanpa verifikasi email/nomor HP. Tersedia kolom opsional 'To' (nama penerima/@akun) dan 'From' (alias/samaran publik yang akan dicetak di Instagram).",
            "Frontend Next.js 16 + REST API POST /api/menfess"
        ),
        (
            "2. Pembatasan Anti-Spam Cerdas Berbasis Session Cookie",
            "Setiap pengunjung diberikan cookie identifikasi sesi aman (<code>menfess_session_id</code>) dengan atribut <code>HttpOnly</code> dan <code>SameSite=Lax</code>. Sistem menerapkan kuota maksimal 3 pesan per 10 menit per sesi, lengkap dengan info sisa kuota dan hitung mundur cooldown otomatis.",
            "In-Memory Sliding Window Rate Limiter"
        ),
        (
            "3. Proteksi Lapis Ganda dengan Hashed IP (Anti-Bypass)",
            "Jika pengunjung menghapus cookie atau beralih browser, sistem tetap mendeteksi IP jaringan yang di-hash dengan algoritma HMAC-SHA256 dan salt rahasia server (<code>RATE_LIMIT_SALT</code>). Kuota tetap terhitung sehingga trik clear-cache tidak dapat membobol limitasi.",
            "Crypto HMAC-SHA256 + Private Salt Salted Hash"
        ),
        (
            "4. Pemotongan Slide Carousel Otomatis (Smart Word-Boundary Segmentation)",
            "Pesan panjang hingga 3.000 karakter tidak akan terpotong sembarangan. Algoritma cerdas memecah teks per batas kata (word boundary) sekitar 450 karakter per slide, menghasilkan hingga maksimal 10 slide gambar berurutan yang rapi untuk carousel feed Instagram.",
            "Library <code>src/lib/slides.ts</code>"
        ),
        (
            "5. Live Preview Template Slide Instagram Real-Time",
            "Di sisi kanan halaman web, pengguna dapat melihat visualisasi langsung bagaimana pesan mereka akan tercetak di poster feed Instagram. Preview menampilkan indikator nomor slide (misal 1/3), nama penerima, alias pengirim, dan isi pesan secara interaktif.",
            "React State Preview Component"
        ),
        (
            "6. Maskot Interaktif 'Chirpy' & Palet Khusus (#006569 & #FFDD00)",
            "Dilengkapi maskot kurir berbulu lucu bernama 'Chirpy' yang interaktif dan dapat berbicara secara real-time saat pengguna mengetik pesan atau mengekliknya. Menggunakan perpaduan warna Deep Pine Teal (#006569) dan aksen Sunshine Yellow (#FFDD00) yang ceria.",
            "Interactive Mascot + Micro-Animations"
        ),
        (
            "7. Background Worker Otomatis untuk Pemrosesan Antrean",
            "Proses pengunduhan antrean menfess, perenderan grafis ke gambar JPEG resolusi tinggi 1080x1080 px, dan pengunggahan ke Instagram berjalan terpisah di background worker (<code>npm run worker</code>). Web frontend tetap ringan, cepat, dan tidak pernah lagging.",
            "Node.js Worker Loop (SQLite Queue)"
        ),
        (
            "8. Fleksibilitas Autentikasi Instagram (Username/Password atau SessionID)",
            "Mendukung posting langsung via kredensial akun biasa (<code>IG_USERNAME</code> &amp; <code>IG_PASSWORD</code>) dengan penyimpanan sesi otomatis di database, maupun direct login via cookie <code>IG_SESSIONID</code> tanpa verifikasi dua langkah yang rumit.",
            "Instagram Private API + Web Upload Engine"
        ),
        (
            "9. Mode Simulasi Pengembang (IG_DEV_MOCK)",
            "Memungkinkan pengujian seluruh alur sistem (pemotongan pesan, rendering slide JPEG, pembaruan status database) tanpa harus menyambungkan akun Instagram sungguhan. Cukup set <code>IG_DEV_MOCK=\"true\"</code> pada file .env.",
            "Mock Worker Engine"
        ),
        (
            "10. Cloudflare Turnstile CAPTCHA (Opsional)",
            "Sistem telah dilengkapi modul verifikasi Turnstile tanpa klik (zero-interaction CAPTCHA). Dapat diaktifkan kapan saja hanya dengan mengisi <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> dan <code>TURNSTILE_SECRET_KEY</code> di .env.",
            "Cloudflare Turnstile Verification API"
        ),
    ]

    for title, desc, tech in features:
        box_data = [
            [
                Paragraph(f"<b>{title}</b>", feature_title),
                Paragraph(f"<font color='#006569'><b>Modul:</b> {tech}</font>", ParagraphStyle("Mod", parent=body_style, alignment=2, fontSize=8)),
            ],
            [
                Paragraph(desc, feature_desc),
                Paragraph("", body_style),
            ],
        ]
        t = Table(box_data, colWidths=[360, 130])
        t.setStyle(TableStyle([
            ('SPAN', (0, 1), (1, 1)),
            ('BACKGROUND', (0, 0), (-1, -1), colors.white),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
            ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.HexColor("#E2E8F0")),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(t)
        story.append(Spacer(1, 5))

    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 3: ARSITEKTUR KEAMANAN & ENKRIPSI PEMBUAT
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("3. Arsitektur Keamanan, Enkripsi &amp; Perlindungan Pemilik", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceAfter=8))

    p_sec = Paragraph(
        "Sesuai instruksi pengguna agar sistem tetap <b>terenkripsi penuh dan identitas pembuat/pemilik terlindungi</b>, "
        "arsitektur keamanan dibangun dengan standar tinggi tanpa menyulitkan pengoperasian harian:",
        body_style
    )
    story.append(p_sec)
    story.append(Spacer(1, 8))

    sec_items = [
        ("Isolasi Kredensial (.env Protection)", "Semua rahasia, password Instagram, session ID, dan kunci enkripsi disimpan eksklusif pada file <code>.env</code> yang dikecualikan dari Git (.gitignore). Kredensial tidak pernah terpapar ke klien browser atau API publik."),
        ("Enkripsi IP Pengirim (Salted HMAC-SHA256)", "Alamat IP pengirim tidak pernah disimpan mentah di database. Sistem mengonversi IP menjadi hash satu arah dengan kunci salt rahasia. Database hanya menyimpan string heksadesimal kriptografi sehingga privasi pengirim dan data audit terjamin."),
        ("Anti-Fingerprinting &amp; Header Hardening", "Header <code>X-Powered-By</code> dinonaktifkan secara permanen di <code>next.config.ts</code>. Dilengkapi <code>X-Content-Type-Options: nosniff</code>, <code>X-Frame-Options: SAMEORIGIN</code>, dan <code>Referrer-Policy</code> ketat guna menggagalkan reconnaissance scanner."),
        ("Eliminasi Total Panel Admin &amp; Surface Attack", "Karena tidak ada rute halaman admin publik, penyerang tidak dapat melakukan serangan credential stuffing, brute-force admin, atau injeksi form autentikasi. Seluruh aksi internal diotomatisasi oleh script worker."),
        ("Database SQLite WAL Mode (Anti-Corruption)", "Database dikonfigurasi dalam mode Write-Ahead Logging (WAL) dengan timeout sibuk 5.000 ms, menjamin konsistensi data tinggi dan mencegah crash antrean saat banyak pesan masuk serentak."),
    ]

    for sec_title, sec_desc in sec_items:
        s_box = [
            [Paragraph(f"🔒 <b>{sec_title}</b>", feature_title)],
            [Paragraph(sec_desc, body_style)],
        ]
        st = Table(s_box, colWidths=[490])
        st.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), SUCCESS_BG),
            ('BOX', (0, 0), (-1, -1), 0.75, SUCCESS_BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ]))
        story.append(st)
        story.append(Spacer(1, 5))

    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 4: SPESIFIKASI TEKNIS SISTEM
    # =========================================================================
    story.append(Paragraph("4. Tabel Spesifikasi Teknis &amp; Komponen", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceAfter=8))

    specs_data = [
        [
            Paragraph("<b>Komponen Sistem</b>", ParagraphStyle("TH2", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white)),
            Paragraph("<b>Teknologi / Pustaka</b>", ParagraphStyle("TH2", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white)),
            Paragraph("<b>Fungsi &amp; Kegunaan</b>", ParagraphStyle("TH2", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white)),
        ],
        [
            Paragraph("<b>Frontend Framework</b>", feature_title),
            Paragraph("Next.js 16.4.3 (Turbopack, App Router)", body_style),
            Paragraph("Render antarmuka super cepat, SSR, dan partial prefetching.", body_style),
        ],
        [
            Paragraph("<b>Styling &amp; Design</b>", feature_title),
            Paragraph("TailwindCSS + Custom Hex (#006569, #D4ECE4)", body_style),
            Paragraph("Desain split-card putih &amp; hijau mint yang memikat.", body_style),
        ],
        [
            Paragraph("<b>Database &amp; ORM</b>", feature_title),
            Paragraph("Prisma ORM + SQLite (WAL Mode)", body_style),
            Paragraph("Penyimpanan antrean menfess yang andal tanpa server DB eksternal.", body_style),
        ],
        [
            Paragraph("<b>Image Render Engine</b>", feature_title),
            Paragraph("Satori + @resvg/resvg-js + Sharp", body_style),
            Paragraph("Otomatis membuat gambar poster JPEG 1080x1080 px berkualitas tinggi.", body_style),
        ],
        [
            Paragraph("<b>Instagram Publisher</b>", feature_title),
            Paragraph("instagram-private-api + Web Upload", body_style),
            Paragraph("Mempublikasikan single image maupun carousel album ke feed IG.", body_style),
        ],
        [
            Paragraph("<b>Anti-Spam &amp; Rate Limit</b>", feature_title),
            Paragraph("Session Cookie + Salted HMAC-SHA256", body_style),
            Paragraph("Membatasi posting 3 pesan per 10 menit tanpa perlu login.", body_style),
        ],
    ]
    sp_table = Table(specs_data, colWidths=[130, 160, 200])
    sp_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('BOX', (0, 0), (-1, -1), 0.75, BORDER_LIGHT),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(sp_table)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECTION 5: PANDUAN PENGOPERASIAN SEDERHANA (NO-RIBET)
    # =========================================================================
    story.append(Paragraph("5. Panduan Pengoperasian Sederhana (Bebas Ribet)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceAfter=8))

    guide_intro = Paragraph(
        "Tidak ada lagi perintah command line yang rumit untuk manipulasi database atau kontrol pengguna. "
        "Aplikasi hanya membutuhkan 2 perintah utama untuk berjalan sepenuhnya:",
        body_style
    )
    story.append(guide_intro)
    story.append(Spacer(1, 8))

    cmd_boxes = [
        (
            "1. Menjalankan Website (Frontend &amp; API)",
            "npm run dev",
            "Membuka portal pengiriman menfess di http://localhost:3000. Pengguna dapat langsung mengirim menfess bebas tanpa login."
        ),
        (
            "2. Menjalankan Robot Pengunggah Instagram (Background Worker)",
            "npm run worker",
            "Menjalankan antrean pemrosesan menfess. Worker mengambil pesan, merender slide JPEG, dan mempostingnya ke Instagram secara berkala."
        ),
        (
            "3. Melihat Status Antrean Singkat (Opsional)",
            "npm run admin",
            "Menampilkan ringkasan singkat jumlah pesan yang menunggu (pending), berhasil (published), atau ditolak (rejected)."
        ),
    ]

    for cmd_title, cmd_text, cmd_desc in cmd_boxes:
        c_box = [
            [Paragraph(f"<b>{cmd_title}</b>", feature_title)],
            [Paragraph(f"<code><b>&gt; {cmd_text}</b></code>", code_style)],
            [Paragraph(cmd_desc, body_style)],
        ]
        ct = Table(c_box, colWidths=[490])
        ct.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
            ('LINEBELOW', (0, 1), (-1, 1), 0.5, colors.HexColor("#E2E8F0")),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(ct)
        story.append(Spacer(1, 5))

    story.append(Spacer(1, 14))

    # Sign-off box
    sign_box = [
        [
            Paragraph("<b>Status Sistem:</b> Siap Operasi (Production Ready)", body_style),
            Paragraph(f"<b>Diperbarui:</b> {datetime.now().strftime('%d %B %Y')}", ParagraphStyle("Right", parent=body_style, alignment=2)),
        ],
        [
            Paragraph("<i>Dokumen fitur ini dibuat secara otomatis sebagai panduan resmi arsitektur sistem Simple IG Menfess.</i>", body_muted),
            Paragraph("<b>Keamanan:</b> 100% Terenkripsi", ParagraphStyle("Right", parent=body_style, alignment=2, textColor=PRIMARY)),
        ],
    ]
    st_sign = Table(sign_box, colWidths=[330, 160])
    st_sign.setStyle(TableStyle([
        ('SPAN', (0, 1), (0, 1)),
        ('BACKGROUND', (0, 0), (-1, -1), SUCCESS_BG),
        ('BOX', (0, 0), (-1, -1), 1, SUCCESS_BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(st_sign)

    # Build document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF Berhasil Dibuat: {output_filename}")


if __name__ == "__main__":
    output_pdf = sys.argv[1] if len(sys.argv) > 1 else "Daftar_Fitur_Dan_Sistem_Menfess.pdf"
    create_feature_list_pdf(output_pdf)
