import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../services/auditService';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Ensure collateral uploads directory exists
const COLLATERAL_UPLOADS_DIR = path.join(__dirname, '../../uploads/collateral');
if (!fs.existsSync(COLLATERAL_UPLOADS_DIR)) {
  fs.mkdirSync(COLLATERAL_UPLOADS_DIR, { recursive: true });
}

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

export class CollateralController {
  /**
   * Upload one or more images for a collateral record.
   * Accepts base64-encoded image data.
   */
  public static async uploadImage(req: Request, res: Response) {
    try {
      const collateralId = parseInt(req.params.collateralId);
      if (isNaN(collateralId)) {
        return res.status(400).json({ message: 'Invalid collateral ID.' });
      }

      const collateral = await prisma.collateral.findFirst({
        where: { id: collateralId, is_deleted: false },
        include: { loan: { select: { id: true } } },
      });

      if (!collateral) {
        return res.status(404).json({ message: 'Collateral record not found.' });
      }

      const { fileName, fileData, fileType } = req.body;

      if (!fileName || !fileData || !fileType) {
        return res.status(400).json({ message: 'fileName, fileData (base64), and fileType are required.' });
      }

      if (!ALLOWED_IMAGE_TYPES.includes(fileType)) {
        return res.status(400).json({
          message: `File type "${fileType}" is not allowed. Allowed types: JPEG, PNG, WEBP, GIF.`,
        });
      }

      // Decode base64 to binary
      const buffer = Buffer.from(fileData, 'base64');

      // Generate safe server-side filename (no user-provided paths)
      const ext = path.extname(fileName) || '.jpg';
      const safeExt = ext.toLowerCase().replace(/[^.a-z0-9]/g, '');
      const serverFileName = `collateral_${collateralId}_${Date.now()}${safeExt}`;
      const filePath = path.join(COLLATERAL_UPLOADS_DIR, serverFileName);

      // Write to filesystem
      fs.writeFileSync(filePath, buffer);

      const userEmail = req.user?.email || 'SYSTEM';

      const image = await prisma.collateralImage.create({
        data: {
          collateralId,
          fileName: path.basename(fileName), // sanitize — only filename, not path
          filePath: `uploads/collateral/${serverFileName}`,
          fileSize: buffer.length,
          fileType,
          uploadedBy: userEmail,
        },
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'CREATE',
        module: 'COLLATERAL',
        newValue: { collateralId, imageId: image.id, fileName: image.fileName },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.status(201).json({
        message: 'Collateral image uploaded successfully.',
        image,
      });
    } catch (error) {
      console.error('Collateral Upload Image Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  /**
   * List all images for a collateral record.
   */
  public static async listImages(req: Request, res: Response) {
    try {
      const collateralId = parseInt(req.params.collateralId);
      if (isNaN(collateralId)) {
        return res.status(400).json({ message: 'Invalid collateral ID.' });
      }

      const collateral = await prisma.collateral.findFirst({
        where: { id: collateralId, is_deleted: false },
      });

      if (!collateral) {
        return res.status(404).json({ message: 'Collateral record not found.' });
      }

      const images = await prisma.collateralImage.findMany({
        where: { collateralId, isDeleted: false },
        orderBy: { uploadedAt: 'desc' },
      });

      return res.json(images);
    } catch (error) {
      console.error('List Collateral Images Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  /**
   * Soft-delete a collateral image.
   */
  public static async deleteImage(req: Request, res: Response) {
    try {
      const imageId = parseInt(req.params.imageId);
      if (isNaN(imageId)) {
        return res.status(400).json({ message: 'Invalid image ID.' });
      }

      const image = await prisma.collateralImage.findFirst({
        where: { id: imageId, isDeleted: false },
      });

      if (!image) {
        return res.status(404).json({ message: 'Image not found.' });
      }

      const userEmail = req.user?.email || 'SYSTEM';

      await prisma.collateralImage.update({
        where: { id: imageId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userEmail,
        },
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'DELETE',
        module: 'COLLATERAL',
        oldValue: { imageId, collateralId: image.collateralId, fileName: image.fileName },
        newValue: { imageId, isDeleted: true, deletedBy: userEmail },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: 'Collateral image soft-deleted successfully.' });
    } catch (error) {
      console.error('Delete Collateral Image Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  /**
   * Get images by loan ID (via the collateral relationship).
   */
  public static async getImagesByLoan(req: Request, res: Response) {
    try {
      const loanId = parseInt(req.params.loanId);
      if (isNaN(loanId)) {
        return res.status(400).json({ message: 'Invalid loan ID.' });
      }

      const collateral = await prisma.collateral.findFirst({
        where: { loanId, is_deleted: false },
        include: {
          collateralImages: {
            where: { isDeleted: false },
            orderBy: { uploadedAt: 'desc' },
          },
        },
      });

      if (!collateral) {
        return res.json({ collateral: null, images: [] });
      }

      return res.json({
        collateral: {
          id: collateral.id,
          type: collateral.type,
          weight: collateral.weight,
          purity: collateral.purity,
          purityUnit: collateral.purityUnit,
          value: collateral.value,
          appraisedValueAtLoanCreation: collateral.appraisedValueAtLoanCreation,
          marketRateAtLoanCreation: collateral.marketRateAtLoanCreation,
          description: collateral.description,
        },
        images: collateral.collateralImages,
      });
    } catch (error) {
      console.error('Get Images By Loan Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }
}
