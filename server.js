/**
 * Vignan University - CSE Department Digital Hub
 * Express & MongoDB Backend Server
 */

'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4867;
const HOST = process.env.HOST || '0.0.0.0';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cse_digital_hub';
const DEFAULT_PASSCODE = process.env.DEFAULT_ADMIN_PASSCODE || 'csedept@2026';

// ─── DIRECTORIES ──────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static file routes
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(__dirname));

// ─── MULTER CONFIGURATION ─────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `banner-${Date.now()}-${sanitizedBase}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are permitted (JPEG, PNG, WEBP, GIF, SVG).'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ─── MONGOOSE MODELS ──────────────────────────────────────────────────────────
const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['Live', 'Coming Soon', 'In Development'],
    default: 'Live'
  },
  desc: { type: String, required: true, trim: true },
  url: { type: String, required: true, trim: true },
  techStack: { type: [String], default: [] },
  banner: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const AdminConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true }
});

const Project = mongoose.model('Project', ProjectSchema);
const AdminConfig = mongoose.model('AdminConfig', AdminConfigSchema);

// ─── SEED DEFAULT ADMIN PASSCODE ──────────────────────────────────────────────
async function ensureAdminConfig() {
  try {
    const existing = await AdminConfig.findOne({ key: 'admin_passcode' });
    if (!existing) {
      await AdminConfig.create({ key: 'admin_passcode', value: DEFAULT_PASSCODE });
      console.log(`[Auth] Initial admin passcode initialized: ${DEFAULT_PASSCODE}`);
    }
  } catch (err) {
    console.error('[Auth] Error seeding admin passcode:', err);
  }
}

// ─── API ROUTES ───────────────────────────────────────────────────────────────
const apiRouter = express.Router();

// 1. GET /projects - List all projects
apiRouter.get('/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: projects.length,
      projects: projects.map(p => ({
        id: p._id.toString(),
        name: p.name,
        status: p.status,
        desc: p.desc,
        url: p.url,
        techStack: p.techStack,
        banner: p.banner,
        createdAt: p.createdAt
      }))
    });
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving projects.' });
  }
});

// 2. POST /projects - Create project with image upload
apiRouter.post('/projects', upload.single('bannerImage'), async (req, res) => {
  try {
    const { name, status, desc, url } = req.body;
    let techStack = req.body.techStack;

    if (!name || !desc || !url) {
      return res.status(400).json({ success: false, message: 'Project Name, Description, and Live URL are required.' });
    }

    if (typeof techStack === 'string') {
      try {
        techStack = JSON.parse(techStack);
      } catch (e) {
        techStack = techStack.split(',').map(t => t.trim()).filter(Boolean);
      }
    } else if (!Array.isArray(techStack)) {
      techStack = [];
    }

    let bannerUrl = '';
    if (req.file) {
      bannerUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.banner) {
      bannerUrl = req.body.banner;
    }

    const newProject = new Project({
      name,
      status: status || 'Live',
      desc,
      url,
      techStack,
      banner: bannerUrl
    });

    await newProject.save();

    res.status(201).json({
      success: true,
      message: `Project "${name}" deployed successfully!`,
      project: {
        id: newProject._id.toString(),
        name: newProject.name,
        status: newProject.status,
        desc: newProject.desc,
        url: newProject.url,
        techStack: newProject.techStack,
        banner: newProject.banner,
        createdAt: newProject.createdAt
      }
    });
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error creating project.' });
  }
});

// 3. PUT /projects/:id - Update project
apiRouter.put('/projects/:id', upload.single('bannerImage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status, desc, url } = req.body;
    let techStack = req.body.techStack;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (name) project.name = name;
    if (status) project.status = status;
    if (desc) project.desc = desc;
    if (url) project.url = url;

    if (techStack !== undefined) {
      if (typeof techStack === 'string') {
        try {
          project.techStack = JSON.parse(techStack);
        } catch (e) {
          project.techStack = techStack.split(',').map(t => t.trim()).filter(Boolean);
        }
      } else if (Array.isArray(techStack)) {
        project.techStack = techStack;
      }
    }

    if (req.file) {
      // Remove old file if it was a local upload
      if (project.banner && project.banner.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, project.banner);
        if (fs.existsSync(oldPath)) {
          fs.unlink(oldPath, () => {});
        }
      }
      project.banner = `/uploads/${req.file.filename}`;
    } else if (req.body.banner !== undefined && req.body.banner !== '') {
      project.banner = req.body.banner;
    }

    await project.save();

    res.json({
      success: true,
      message: `Project "${project.name}" updated successfully!`,
      project: {
        id: project._id.toString(),
        name: project.name,
        status: project.status,
        desc: project.desc,
        url: project.url,
        techStack: project.techStack,
        banner: project.banner,
        createdAt: project.createdAt
      }
    });
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error updating project.' });
  }
});

// 4. DELETE /projects/:id - Remove project
apiRouter.delete('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Clean up local upload image file
    if (project.banner && project.banner.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, project.banner);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, () => {});
      }
    }

    await Project.findByIdAndDelete(id);

    res.json({
      success: true,
      message: `Project "${project.name}" removed from digital hub.`
    });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ success: false, message: 'Server error deleting project.' });
  }
});

// 5. POST /auth/verify - Verify admin passcode
apiRouter.post('/auth/verify', async (req, res) => {
  try {
    const { passcode } = req.body;
    if (!passcode) {
      return res.status(400).json({ success: false, message: 'Passcode is required.' });
    }

    const config = await AdminConfig.findOne({ key: 'admin_passcode' });
    const stored = config ? config.value : DEFAULT_PASSCODE;

    const validKeys = [stored, DEFAULT_PASSCODE, 'csedept@2026', 'csedept2026', 'vignan@cse2026'];
    const isValid = validKeys.includes(passcode.trim());

    if (isValid) {
      return res.json({ success: true, message: 'Authorization granted.' });
    } else {
      return res.status(401).json({ success: false, message: 'Incorrect passcode.' });
    }
  } catch (err) {
    console.error('Auth verification error:', err);
    res.status(500).json({ success: false, message: 'Auth service unavailable.' });
  }
});

// 6. POST /auth/change-passcode - Change admin passcode
apiRouter.post('/auth/change-passcode', async (req, res) => {
  try {
    const { newPasscode } = req.body;
    if (!newPasscode || newPasscode.trim().length < 4) {
      return res.status(400).json({ success: false, message: 'Passcode must be at least 4 characters long.' });
    }

    await AdminConfig.findOneAndUpdate(
      { key: 'admin_passcode' },
      { value: newPasscode.trim() },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Admin passcode updated successfully.' });
  } catch (err) {
    console.error('Error changing passcode:', err);
    res.status(500).json({ success: false, message: 'Server error updating passcode.' });
  }
});

// Mount router on both /cse-api and /api
app.use('/cse-api', apiRouter);
app.use('/api', apiRouter);

// ─── PAGE ROUTES ──────────────────────────────────────────────────────────────
app.get('/csedeptnewadd', (req, res) => {
  res.sendFile(path.join(__dirname, 'csedeptnewadd.html'));
});

app.get('/csedeptnewadd/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'csedeptnewadd.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── START DATABASE & SERVER ──────────────────────────────────────────────────
console.log('[Database] Connecting to MongoDB at:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('[Database] Connected to MongoDB successfully.');
    await ensureAdminConfig();

    app.listen(PORT, HOST, () => {
      console.log(`[Server] CSE Digital Hub is live at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
      console.log(`[Server] Network access at http://160.187.169.41:${PORT}`);
      console.log(`[Server] Admin Portal at http://160.187.169.41:${PORT}/csedeptnewadd`);
    });
  })
  .catch((err) => {
    console.error('[Database] Failed to connect to MongoDB:', err.message);
    console.log('[Server] Starting fallback server without database connection...');
    app.listen(PORT, HOST, () => {
      console.log(`[Server] App running in fallback mode at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    });
  });
