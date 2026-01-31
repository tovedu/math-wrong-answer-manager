'use server';

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function uploadImage(formData: FormData) {
    const file = formData.get('file') as File;

    if (!file) {
        throw new Error('No file uploaded');
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure uploads directory exists
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const uniqueName = `${crypto.randomUUID()}-${file.name}`;
    const path = join(uploadDir, uniqueName);

    // Write file
    await writeFile(path, buffer);

    // Return public URL
    return `/uploads/${uniqueName}`;
}
