// @ts-nocheck
/**
 * File Components
 * Exports all file-related React components
 */

// File Uploader
export { default as FileUploader } from './FileUploader';
export type {
  UploadedFile,
  FileUploadState,
  FileUploaderProps,
} from './FileUploader';

// File Preview
export { default as FilePreview, InlineFilePreview } from './FilePreview';
export type {
  FilePreviewProps,
  InlineFilePreviewProps,
} from './FilePreview';

// File Analysis
export { default as FileAnalysis, AnalysisResult } from './FileAnalysis';
export type {
  FileAnalysisProps,
  AnalysisResultProps,
} from './FileAnalysis';

// Chat File Attachment
export {
  default as ChatFileAttachment,
  AttachmentButton,
  AttachedFilesList,
  MessageFiles,
} from './ChatFileAttachment';
export type {
  AttachedFile,
  ChatFileAttachmentProps,
  AttachmentButtonProps,
  AttachedFilesListProps,
  MessageFilesProps,
} from './ChatFileAttachment';
