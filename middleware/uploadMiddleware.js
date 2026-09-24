import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure destination exists
const uploadDir = path.join(__dirname, "..", "public", "uploads", "avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "avatar-" + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|svg/;
  const mime = file.mimetype.toLowerCase();
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");

  if (allowed.test(ext) || allowed.test(mime)) {
    cb(null, true);
  } else {
    cb(new Error("Format file tidak didukung. Harap unggah berkas gambar (JPG, PNG, WEBP)."));
  }
};

export const uploadAvatar = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

const evidenceDir = path.join(__dirname, "..", "public", "uploads", "evidence");
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

const evidenceStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, evidenceDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "evidence-" + uniqueSuffix + ext);
  }
});

export const uploadEvidence = multer({
  storage: evidenceStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

const transcriptDir = path.join(__dirname, "..", "public", "uploads", "transcripts");
if (!fs.existsSync(transcriptDir)) {
  fs.mkdirSync(transcriptDir, { recursive: true });
}

const transcriptStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, transcriptDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "transcript-" + uniqueSuffix + ext);
  }
});

const transcriptFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  const allowed = /^(txt|md|docx|doc|csv)$/i;

  if (allowed.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Format file tidak didukung. Harap unggah berkas dokumen transkrip (.txt, .docx, .md)."));
  }
};

export const uploadTranscript = multer({
  storage: transcriptStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: transcriptFilter
});

export default {
  uploadAvatar,
  uploadEvidence,
  uploadTranscript
};
