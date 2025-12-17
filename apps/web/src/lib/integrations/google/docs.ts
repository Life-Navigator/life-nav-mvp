/**
 * Google Docs API Client
 */

import type { GoogleDoc, DocContent } from './types';

const DOCS_API_BASE = 'https://docs.googleapis.com/v1';

export class GoogleDocsClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${DOCS_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Docs API error: ${error.error?.message || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Get a document
   */
  async getDocument(documentId: string): Promise<GoogleDoc> {
    return this.request<GoogleDoc>(`/documents/${documentId}`);
  }

  /**
   * Create a new document
   */
  async createDocument(title: string): Promise<GoogleDoc> {
    return this.request<GoogleDoc>('/documents', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  /**
   * Get document text content
   */
  getDocumentText(doc: GoogleDoc): string {
    const texts: string[] = [];

    for (const element of doc.body.content) {
      if (element.paragraph) {
        for (const paragraphElement of element.paragraph.elements) {
          if (paragraphElement.textRun?.content) {
            texts.push(paragraphElement.textRun.content);
          }
        }
      }
    }

    return texts.join('');
  }

  /**
   * Batch update document
   */
  async batchUpdate(
    documentId: string,
    requests: DocUpdateRequest[]
  ): Promise<{
    documentId: string;
    replies: object[];
  }> {
    return this.request(`/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });
  }

  /**
   * Insert text at location
   */
  async insertText(
    documentId: string,
    text: string,
    location: { index: number } | { endOfSegmentLocation: object }
  ): Promise<void> {
    await this.batchUpdate(documentId, [
      {
        insertText: {
          text,
          location,
        },
      },
    ]);
  }

  /**
   * Insert text at the end of the document
   */
  async appendText(documentId: string, text: string): Promise<void> {
    await this.insertText(documentId, text, {
      endOfSegmentLocation: {},
    });
  }

  /**
   * Delete content in a range
   */
  async deleteContent(
    documentId: string,
    startIndex: number,
    endIndex: number
  ): Promise<void> {
    await this.batchUpdate(documentId, [
      {
        deleteContentRange: {
          range: {
            startIndex,
            endIndex,
          },
        },
      },
    ]);
  }

  /**
   * Replace all occurrences of text
   */
  async replaceAllText(
    documentId: string,
    searchText: string,
    replaceText: string,
    matchCase: boolean = true
  ): Promise<{ occurrencesChanged: number }> {
    const result = await this.batchUpdate(documentId, [
      {
        replaceAllText: {
          containsText: {
            text: searchText,
            matchCase,
          },
          replaceText,
        },
      },
    ]);

    const reply = result.replies[0] as { replaceAllText?: { occurrencesChanged: number } };
    return { occurrencesChanged: reply.replaceAllText?.occurrencesChanged || 0 };
  }

  /**
   * Insert inline image
   */
  async insertImage(
    documentId: string,
    imageUri: string,
    location: { index: number },
    size?: { width: number; height: number }
  ): Promise<void> {
    const inlineObjectProperties: Record<string, unknown> = {
      embeddedObject: {
        imageProperties: {
          contentUri: imageUri,
        },
      },
    };

    if (size) {
      inlineObjectProperties.embeddedObject = {
        ...inlineObjectProperties.embeddedObject as object,
        size: {
          width: { magnitude: size.width, unit: 'PT' },
          height: { magnitude: size.height, unit: 'PT' },
        },
      };
    }

    await this.batchUpdate(documentId, [
      {
        insertInlineImage: {
          uri: imageUri,
          location,
          objectSize: size
            ? {
                width: { magnitude: size.width, unit: 'PT' },
                height: { magnitude: size.height, unit: 'PT' },
              }
            : undefined,
        },
      },
    ]);
  }

  /**
   * Update paragraph style
   */
  async updateParagraphStyle(
    documentId: string,
    startIndex: number,
    endIndex: number,
    style: ParagraphStyle
  ): Promise<void> {
    const fields: string[] = [];
    const paragraphStyle: Record<string, unknown> = {};

    if (style.alignment) {
      fields.push('alignment');
      paragraphStyle.alignment = style.alignment;
    }
    if (style.namedStyleType) {
      fields.push('namedStyleType');
      paragraphStyle.namedStyleType = style.namedStyleType;
    }
    if (style.lineSpacing) {
      fields.push('lineSpacing');
      paragraphStyle.lineSpacing = style.lineSpacing;
    }
    if (style.spaceAbove) {
      fields.push('spaceAbove');
      paragraphStyle.spaceAbove = { magnitude: style.spaceAbove, unit: 'PT' };
    }
    if (style.spaceBelow) {
      fields.push('spaceBelow');
      paragraphStyle.spaceBelow = { magnitude: style.spaceBelow, unit: 'PT' };
    }

    await this.batchUpdate(documentId, [
      {
        updateParagraphStyle: {
          range: { startIndex, endIndex },
          paragraphStyle,
          fields: fields.join(','),
        },
      },
    ]);
  }

  /**
   * Update text style
   */
  async updateTextStyle(
    documentId: string,
    startIndex: number,
    endIndex: number,
    style: TextStyle
  ): Promise<void> {
    const fields: string[] = [];
    const textStyle: Record<string, unknown> = {};

    if (style.bold !== undefined) {
      fields.push('bold');
      textStyle.bold = style.bold;
    }
    if (style.italic !== undefined) {
      fields.push('italic');
      textStyle.italic = style.italic;
    }
    if (style.underline !== undefined) {
      fields.push('underline');
      textStyle.underline = style.underline;
    }
    if (style.strikethrough !== undefined) {
      fields.push('strikethrough');
      textStyle.strikethrough = style.strikethrough;
    }
    if (style.fontSize) {
      fields.push('fontSize');
      textStyle.fontSize = { magnitude: style.fontSize, unit: 'PT' };
    }
    if (style.foregroundColor) {
      fields.push('foregroundColor');
      textStyle.foregroundColor = {
        color: { rgbColor: hexToRgb(style.foregroundColor) },
      };
    }
    if (style.backgroundColor) {
      fields.push('backgroundColor');
      textStyle.backgroundColor = {
        color: { rgbColor: hexToRgb(style.backgroundColor) },
      };
    }
    if (style.link) {
      fields.push('link');
      textStyle.link = { url: style.link };
    }

    await this.batchUpdate(documentId, [
      {
        updateTextStyle: {
          range: { startIndex, endIndex },
          textStyle,
          fields: fields.join(','),
        },
      },
    ]);
  }

  /**
   * Insert table
   */
  async insertTable(
    documentId: string,
    rows: number,
    columns: number,
    location: { index: number }
  ): Promise<void> {
    await this.batchUpdate(documentId, [
      {
        insertTable: {
          rows,
          columns,
          location,
        },
      },
    ]);
  }

  /**
   * Insert page break
   */
  async insertPageBreak(
    documentId: string,
    location: { index: number }
  ): Promise<void> {
    await this.batchUpdate(documentId, [
      {
        insertPageBreak: { location },
      },
    ]);
  }

  /**
   * Create named range
   */
  async createNamedRange(
    documentId: string,
    name: string,
    startIndex: number,
    endIndex: number
  ): Promise<string> {
    const result = await this.batchUpdate(documentId, [
      {
        createNamedRange: {
          name,
          range: { startIndex, endIndex },
        },
      },
    ]);

    const reply = result.replies[0] as { createNamedRange?: { namedRangeId: string } };
    return reply.createNamedRange?.namedRangeId || '';
  }

  /**
   * Delete named range
   */
  async deleteNamedRange(
    documentId: string,
    namedRangeId: string
  ): Promise<void> {
    await this.batchUpdate(documentId, [
      {
        deleteNamedRange: { namedRangeId },
      },
    ]);
  }
}

// Types for update requests
export interface DocUpdateRequest {
  insertText?: {
    text: string;
    location: { index: number } | { endOfSegmentLocation: object };
  };
  deleteContentRange?: {
    range: { startIndex: number; endIndex: number };
  };
  replaceAllText?: {
    containsText: { text: string; matchCase: boolean };
    replaceText: string;
  };
  insertInlineImage?: {
    uri: string;
    location: { index: number };
    objectSize?: object;
  };
  updateParagraphStyle?: {
    range: { startIndex: number; endIndex: number };
    paragraphStyle: object;
    fields: string;
  };
  updateTextStyle?: {
    range: { startIndex: number; endIndex: number };
    textStyle: object;
    fields: string;
  };
  insertTable?: {
    rows: number;
    columns: number;
    location: { index: number };
  };
  insertPageBreak?: {
    location: { index: number };
  };
  createNamedRange?: {
    name: string;
    range: { startIndex: number; endIndex: number };
  };
  deleteNamedRange?: {
    namedRangeId: string;
  };
}

export interface ParagraphStyle {
  alignment?: 'START' | 'CENTER' | 'END' | 'JUSTIFIED';
  namedStyleType?:
    | 'NORMAL_TEXT'
    | 'TITLE'
    | 'SUBTITLE'
    | 'HEADING_1'
    | 'HEADING_2'
    | 'HEADING_3'
    | 'HEADING_4'
    | 'HEADING_5'
    | 'HEADING_6';
  lineSpacing?: number;
  spaceAbove?: number;
  spaceBelow?: number;
}

export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: number;
  foregroundColor?: string; // Hex color
  backgroundColor?: string; // Hex color
  link?: string;
}

// Helper function to convert hex color to RGB
function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { red: 0, green: 0, blue: 0 };
  }
  return {
    red: parseInt(result[1], 16) / 255,
    green: parseInt(result[2], 16) / 255,
    blue: parseInt(result[3], 16) / 255,
  };
}

// Factory function
export function createGoogleDocsClient(accessToken: string): GoogleDocsClient {
  return new GoogleDocsClient(accessToken);
}
