"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var initializeApp = require('firebase/app').initializeApp;
var _a = require('firebase/firestore'), getFirestore = _a.getFirestore, collection = _a.collection, addDoc = _a.addDoc;
var _b = require('firebase/storage'), getStorage = _b.getStorage, ref = _b.ref, uploadBytes = _b.uploadBytes, getDownloadURL = _b.getDownloadURL;
var sqlite3 = require('sqlite3');
var open = require('sqlite').open;
var fs = require('fs/promises');
var path = require('path');
var dotenv = require('dotenv');
var GeminiParserService = require('../src/services/GeminiParserService').GeminiParserService;
var PDFParserService = require('../src/services/PDFParserService');
var ThumbnailService = require('../src/services/ThumbnailService');
var TranscriptionService = require('../src/services/TranscriptionService');
dotenv.config();
// Firebase configuration - you'll need to add these to your .env file
var firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};
// Initialize Firebase
var app = initializeApp(firebaseConfig);
var db = getFirestore(app);
var storage = getStorage(app);
// Absolute paths
var DB_PATH = '/Users/gauntlet/Documents/projects/jobs/linkedinscraper/data/my_database.db';
var VIDEOS_DIR = '/Users/gauntlet/Documents/projects/jobs/linkedinscraper/videos';
function ensureDirectoriesExist() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // Ensure database directory exists
                return [4 /*yield*/, fs.mkdir(path.dirname(DB_PATH), { recursive: true })];
                case 1:
                    // Ensure database directory exists
                    _a.sent();
                    // Ensure videos directory exists
                    return [4 /*yield*/, fs.mkdir(VIDEOS_DIR, { recursive: true })];
                case 2:
                    // Ensure videos directory exists
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function uploadVideo(videoPath, jobId, userId) {
    return __awaiter(this, void 0, void 0, function () {
        var fileBuffer, videoFile, thumbnailFile, videoStorageRef, videoUrl, thumbnailStorageRef, thumbnailUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fs.readFile(videoPath)];
                case 1:
                    fileBuffer = _a.sent();
                    videoFile = new File([fileBuffer], path.basename(videoPath), {
                        type: 'video/mp4' // Adjust if your videos are in a different format
                    });
                    // Generate thumbnail
                    console.log("Generating thumbnail for job ".concat(jobId, "..."));
                    return [4 /*yield*/, ThumbnailService.generateThumbnail(videoFile)];
                case 2:
                    thumbnailFile = _a.sent();
                    videoStorageRef = ref(storage, "videos/".concat(userId, "/").concat(path.basename(videoPath)));
                    return [4 /*yield*/, uploadBytes(videoStorageRef, fileBuffer)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, getDownloadURL(videoStorageRef)];
                case 4:
                    videoUrl = _a.sent();
                    thumbnailStorageRef = ref(storage, "thumbnails/".concat(userId, "/").concat(jobId, "/thumbnail.jpg"));
                    return [4 /*yield*/, uploadBytes(thumbnailStorageRef, thumbnailFile)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, getDownloadURL(thumbnailStorageRef)];
                case 6:
                    thumbnailUrl = _a.sent();
                    return [2 /*return*/, [videoUrl, thumbnailUrl]];
            }
        });
    });
}
function parseJobDescription(text_1) {
    return __awaiter(this, arguments, void 0, function (text, useGemini) {
        var geminiApiKey, geminiParser, base64String, blob, file;
        if (useGemini === void 0) { useGemini = true; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!useGemini) return [3 /*break*/, 2];
                    geminiApiKey = process.env.GEMINI_API_KEY;
                    if (!geminiApiKey) {
                        throw new Error('GEMINI_API_KEY is not configured in your environment');
                    }
                    geminiParser = new GeminiParserService(geminiApiKey);
                    base64String = Buffer.from(text).toString('base64');
                    return [4 /*yield*/, geminiParser.parseJobDescription(base64String)];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    blob = new Blob([text], { type: 'application/pdf' });
                    file = new File([blob], 'job_description.pdf', { type: 'application/pdf' });
                    return [4 /*yield*/, PDFParserService.parsePDF(file)];
                case 3: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function uploadJobs(adminUid_1) {
    return __awaiter(this, arguments, void 0, function (adminUid, useGemini) {
        var sqliteDb, jobs, _loop_1, _i, jobs_1, job, error_1;
        if (useGemini === void 0) { useGemini = true; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ensureDirectoriesExist()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, open({
                            filename: DB_PATH,
                            driver: sqlite3.Database
                        })];
                case 2:
                    sqliteDb = _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 9, 10, 12]);
                    return [4 /*yield*/, sqliteDb.all("\n      SELECT \n        id,\n        title,\n        company,\n        location,\n        date,\n        job_url,\n        job_description,\n        pitch_script,\n        date_loaded\n      FROM jobs \n      WHERE pitch_script IS NOT NULL\n        AND length(job_description) > 100\n    ")];
                case 4:
                    jobs = _a.sent();
                    _loop_1 = function (job) {
                        var videoFiles, videoFile, videoPath, _b, videoUrl, thumbnailUrl, parsedJobDescription, videoBuffer, videoBlob, transcriptionResult, tags, jobData;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0: return [4 /*yield*/, fs.readdir(VIDEOS_DIR)];
                                case 1:
                                    videoFiles = _c.sent();
                                    videoFile = videoFiles.find(function (file) { return file.startsWith(job.id.toString()); });
                                    if (!videoFile) {
                                        console.log("No video found for job ".concat(job.id, ", skipping..."));
                                        return [2 /*return*/, "continue"];
                                    }
                                    videoPath = path.join(VIDEOS_DIR, videoFile);
                                    return [4 /*yield*/, uploadVideo(videoPath, job.id.toString(), adminUid)];
                                case 2:
                                    _b = _c.sent(), videoUrl = _b[0], thumbnailUrl = _b[1];
                                    // Parse job description using existing services
                                    console.log("Parsing job description for ".concat(job.id, "..."));
                                    return [4 /*yield*/, parseJobDescription(job.job_description, useGemini)];
                                case 3:
                                    parsedJobDescription = _c.sent();
                                    // Transcribe video to get proper timestamps
                                    console.log("Transcribing video for job ".concat(job.id, "..."));
                                    return [4 /*yield*/, fs.readFile(videoPath)];
                                case 4:
                                    videoBuffer = _c.sent();
                                    videoBlob = new File([videoBuffer], path.basename(videoPath), { type: 'video/mp4' });
                                    return [4 /*yield*/, TranscriptionService.transcribeVideo(videoBlob)];
                                case 5:
                                    transcriptionResult = _c.sent();
                                    tags = __spreadArray(__spreadArray([
                                        job.company
                                    ], parsedJobDescription.skills.slice(0, 3), true), [
                                        parsedJobDescription.employmentType,
                                        parsedJobDescription.experienceLevel
                                    ], false).filter(Boolean);
                                    jobData = {
                                        id: job.id.toString(),
                                        title: job.title,
                                        videoUrl: videoUrl,
                                        thumbnailUrl: thumbnailUrl,
                                        jobDescription: __assign(__assign({}, parsedJobDescription), { 
                                            // Override with database values if needed
                                            title: job.title, company: job.company, location: job.location, applicationUrl: job.job_url }),
                                        tags: tags,
                                        userId: adminUid,
                                        createdAt: new Date().toISOString(), // Use current timestamp like Upload component
                                        views: 0,
                                        likes: 0,
                                        transcript: transcriptionResult
                                    };
                                    // Add to Firestore
                                    return [4 /*yield*/, addDoc(collection(db, 'videos'), jobData)];
                                case 6:
                                    // Add to Firestore
                                    _c.sent();
                                    console.log("Uploaded job ".concat(job.id, " with thumbnail and transcript"));
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, jobs_1 = jobs;
                    _a.label = 5;
                case 5:
                    if (!(_i < jobs_1.length)) return [3 /*break*/, 8];
                    job = jobs_1[_i];
                    return [5 /*yield**/, _loop_1(job)];
                case 6:
                    _a.sent();
                    _a.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 5];
                case 8: return [3 /*break*/, 12];
                case 9:
                    error_1 = _a.sent();
                    console.error('Error uploading jobs:', error_1);
                    throw error_1;
                case 10: return [4 /*yield*/, sqliteDb.close()];
                case 11:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 12: return [2 /*return*/];
            }
        });
    });
}
// Usage example
if (require.main === module) {
    var adminUid = process.argv[2]; // Firebase Authentication UID of the admin user
    var useGemini = process.argv[3] !== 'false'; // Default to true unless explicitly set to false
    if (!adminUid) {
        console.error('Usage: ts-node upload_jobs.ts <admin_firebase_uid> [use_gemini]');
        console.error('Note: The admin_firebase_uid should be the Firebase Authentication UID of the admin user');
        process.exit(1);
    }
    uploadJobs(adminUid, useGemini)
        .then(function () {
        console.log('All jobs uploaded successfully');
        process.exit(0);
    })
        .catch(function (error) {
        console.error('Failed to upload jobs:', error);
        process.exit(1);
    });
}
module.exports = { uploadJobs: uploadJobs };
