"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIService = exports.CVSchemaObj = exports.JobDescriptionSchemaObj = void 0;
// Schema definitions as objects for use in prompts
exports.JobDescriptionSchemaObj = {
    title: "Job title",
    company: "Company name",
    location: "Job location",
    employmentType: "Full-time/Part-time/Contract",
    experienceLevel: "Entry/Mid/Senior level",
    skills: ["Required skill 1", "Required skill 2"],
    responsibilities: ["Responsibility 1", "Responsibility 2"],
    requirements: ["Requirement 1", "Requirement 2"],
    benefits: ["Benefit 1", "Benefit 2"],
    salary: {
        min: "minimum salary (number)",
        max: "maximum salary (number)",
        currency: "USD/EUR/etc",
        period: "yearly/monthly"
    }
};
exports.CVSchemaObj = {
    personalInfo: {
        name: "Full name",
        email: "Email address (if provided)",
        phone: "Phone number (if provided)",
        location: "Location (if provided)",
        summary: "Professional summary/objective"
    },
    experience: [{
            company: "Company name",
            title: "Job title",
            location: "Job location",
            startDate: "Start date (YYYY-MM format)",
            endDate: "End date (YYYY-MM format) or null if current",
            current: "true/false",
            highlights: ["Achievement/responsibility 1", "Achievement/responsibility 2"]
        }],
    education: [{
            institution: "School/University name",
            degree: "Degree type (e.g., Bachelor's, Master's)",
            field: "Field of study",
            graduationDate: "YYYY-MM format",
            gpa: "GPA number if provided"
        }],
    skills: [{
            category: "Skill category (e.g., Programming Languages, Tools)",
            items: ["Skill 1", "Skill 2"]
        }],
    certifications: [{
            name: "Certification name",
            issuer: "Issuing organization",
            date: "YYYY-MM format"
        }],
    languages: [{
            language: "Language name",
            proficiency: "Proficiency level"
        }]
};
var OpenAIService = /** @class */ (function () {
    function OpenAIService() {
    }
    OpenAIService.getApiKey = function () {
        return __awaiter(this, void 0, void 0, function () {
            var key;
            return __generator(this, function (_a) {
                key = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
                if (!key) {
                    throw new Error('OpenAI API key not found in environment variables');
                }
                return [2 /*return*/, key];
            });
        });
    };
    OpenAIService.structureJobDescription = function (text) {
        return __awaiter(this, void 0, void 0, function () {
            var apiKey, prompt_1, response, error, result, structuredData, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, this.getApiKey()];
                    case 1:
                        apiKey = _a.sent();
                        prompt_1 = "Please analyze this job description and structure it according to the following json schema:\n".concat(JSON.stringify(exports.JobDescriptionSchemaObj, null, 2), "\n\nIf any field is not found in the text, omit it from the response. For the salary, only include it if specific numbers are mentioned.\n\nJob Description:\n").concat(text);
                        return [4 /*yield*/, fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': "Bearer ".concat(apiKey),
                                },
                                body: JSON.stringify({
                                    model: 'gpt-4o',
                                    messages: [{
                                            role: 'user',
                                            content: prompt_1
                                        }],
                                    temperature: 0.3,
                                    response_format: { type: "json_object" }
                                })
                            })];
                    case 2:
                        response = _a.sent();
                        if (!!response.ok) return [3 /*break*/, 4];
                        return [4 /*yield*/, response.text()];
                    case 3:
                        error = _a.sent();
                        throw new Error("OpenAI API error: ".concat(error));
                    case 4: return [4 /*yield*/, response.json()];
                    case 5:
                        result = _a.sent();
                        structuredData = JSON.parse(result.choices[0].message.content);
                        return [2 /*return*/, structuredData];
                    case 6:
                        error_1 = _a.sent();
                        console.error('Error structuring job description:', error_1);
                        throw error_1;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    OpenAIService.structureCV = function (text) {
        return __awaiter(this, void 0, void 0, function () {
            var apiKey, prompt_2, response, error, result, structuredData, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, this.getApiKey()];
                    case 1:
                        apiKey = _a.sent();
                        prompt_2 = "Please analyze this CV/resume and structure it according to the following json schema:\n".concat(JSON.stringify(exports.CVSchemaObj, null, 2), "\n\nIf any field is not found in the text, omit it from the response. Try to categorize skills into logical groups.\n\nCV Text:\n").concat(text);
                        return [4 /*yield*/, fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': "Bearer ".concat(apiKey),
                                },
                                body: JSON.stringify({
                                    model: 'gpt-4o',
                                    messages: [{
                                            role: 'user',
                                            content: prompt_2
                                        }],
                                    temperature: 0.3,
                                    response_format: { type: "json_object" }
                                })
                            })];
                    case 2:
                        response = _a.sent();
                        if (!!response.ok) return [3 /*break*/, 4];
                        return [4 /*yield*/, response.text()];
                    case 3:
                        error = _a.sent();
                        throw new Error("OpenAI API error: ".concat(error));
                    case 4: return [4 /*yield*/, response.json()];
                    case 5:
                        result = _a.sent();
                        structuredData = JSON.parse(result.choices[0].message.content);
                        return [2 /*return*/, structuredData];
                    case 6:
                        error_2 = _a.sent();
                        console.error('Error structuring CV:', error_2);
                        throw error_2;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    return OpenAIService;
}());
exports.OpenAIService = OpenAIService;
