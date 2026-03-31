import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

// Configure S3 client for DigitalOcean Spaces
const s3Client = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT || "https://nyc3.digitaloceanspaces.com",
    region: process.env.DO_SPACES_REGION || "nyc3",
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY || "",
        secretAccessKey: process.env.DO_SPACES_SECRET || "",
    },
    forcePathStyle: false,
});

const BUCKET = process.env.DO_SPACES_BUCKET || "";

/**
 * Upload a file buffer to DigitalOcean Spaces
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
    const endpoint = process.env.DO_SPACES_ENDPOINT || "https://nyc3.digitaloceanspaces.com";
    const fileUrl = `${endpoint}/${BUCKET}/${key}`;
    
    console.log(`File uploaded to DO Spaces: ${fileUrl}`);
    return fileUrl;
};

/**
 * Download a file from DigitalOcean Spaces
 * @param {string} fileUrl - The full file URL
 * @returns {Buffer} The file buffer
 */
export const downloadFromSpaces = async (fileUrl) => {
    // Extract the key from the URL
    const endpoint = process.env.DO_SPACES_ENDPOINT || "https://nyc3.digitaloceanspaces.com";
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
