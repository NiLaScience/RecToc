import * as TJS from 'typescript-json-schema';
import * as fs from 'fs';
import * as path from 'path';

// Settings for schema generation
const settings: TJS.PartialArgs = {
  required: true,
  strictNullChecks: true,
  ref: false,
  aliasRef: false,
  topRef: false,
  noExtraProps: true,
  excludePrivate: true,
  defaultNumberType: "number"
};

// Get absolute paths to our type files
const basePath = path.join(process.cwd(), 'src');
const program = TJS.getProgramFromFiles(
  [
    path.join(basePath, 'types/user.ts'),
    path.join(basePath, 'types/job_opening.ts')
  ],
  settings,
  basePath
);

// Generate schemas
const cvSchema = TJS.generateSchema(program, 'CVSchema', settings);
const jobSchema = TJS.generateSchema(program, 'JobDescription', settings);

// Create schemas directory if it doesn't exist
const schemasDir = path.join(process.cwd(), 'src/schemas');
if (!fs.existsSync(schemasDir)) {
  fs.mkdirSync(schemasDir, { recursive: true });
}

// Write schemas to files
fs.writeFileSync(
  path.join(schemasDir, 'cv-schema.json'),
  JSON.stringify(cvSchema, null, 2)
);

fs.writeFileSync(
  path.join(schemasDir, 'job-schema.json'),
  JSON.stringify(jobSchema, null, 2)
);

console.log('✨ JSON Schemas generated successfully!'); 