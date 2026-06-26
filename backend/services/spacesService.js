import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

const bucketEndpoint = process.env.B2_ENDPOINT || "https://s3.us-west-004.backblazeb2.com";
const bucketRegion = process.env.B2_REGION || "us-west-004";
const bucketAccessKeyId = process.env.B2_KEY_ID || "";
const bucketSecretAccessKey = process.env.B2_APPLICATION_KEY || "";
const bucketName = process.env.B2_BUCKET || "";

// Configure S3 client for Backblaze B2
const s3Client = new S3Client({
    endpoint: bucketEndpoint,
    region: bucketRegion,
    credentials: {
        accessKeyId: bucketAccessKeyId,
        secretAccessKey: bucketSecretAccessKey,
    },
    forcePathStyle: false,
});

const BUCKET = bucketName;

/**
 * Upload a file buffer to the configured S3-compatible bucket
 * @param {Buffer} buffer - The raw file buffer
 * @param {string} fileName - Original file name (used to build the key)
 * @param {string} fileId - Unique file ID for namespacing
 * @returns {string} The permanent file URL
 */
export const uploadToSpaces = async (buffer, fileName, fileId) => {
    const key = `uploads/${fileId}/${fileName}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ACL: "private",
        ContentType: getContentType(fileName),
    });

    await s3Client.send(command);

    // Build the permanent URL
    const endpoint = bucketEndpoint;
    const fileUrl = `${endpoint}/${BUCKET}/${key}`;
    
    console.log(`File uploaded to bucket storage: ${fileUrl}`);
    return fileUrl;
};

/**
 * Download a file from the configured S3-compatible bucket
 * @param {string} fileUrl - The full file URL
 * @returns {Buffer} The file buffer
 */
export const downloadFromSpaces = async (fileUrl) => {
    // Extract the key from the URL
    const endpoint = bucketEndpoint;
    const prefix = `${endpoint}/${BUCKET}/`;
    const key = fileUrl.replace(prefix, "");

    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });

    const response = await s3Client.send(command);

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

/**
 * Determine content type from file extension
 */
function getContentType(fileName) {
    const ext = fileName.toLowerCase().split(".").pop();
    const types = {
        csv: "text/csv",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        xls: "application/vnd.ms-excel",
    };
    return types[ext] || "application/octet-stream";
}

export default { uploadToSpaces, downloadFromSpaces };
