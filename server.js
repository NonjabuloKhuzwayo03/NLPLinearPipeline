const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Zulu Morphological Analyzer Class
class ZuluMorphAnalyzer {
    constructor() {
        // Initialize Zulu morphological patterns and rules
        this.initializeMorphPatterns();
        this.initializeVocabulary();
    }

    initializeMorphPatterns() {
        // Noun class prefixes
        this.nounPrefixes = {
            'umu': { class: 1, type: 'NPrePre1' },
            'aba': { class: 2, type: 'NPrePre2' },
            'umu': { class: 3, type: 'NPrePre3' },
            'imi': { class: 4, type: 'NPrePre4' },
            'ili': { class: 5, type: 'NPrePre5' },
            'ama': { class: 6, type: 'NPrePre6' },
            'isi': { class: 7, type: 'NPrePre7' },
            'izi': { class: 8, type: 'NPrePre8' },
            'in': { class: 9, type: 'NPrePre9' },
            'izin': { class: 10, type: 'NPrePre10' },
            'ulu': { class: 11, type: 'NPrePre11' },
            'ubu': { class: 14, type: 'NPrePre14' },
            'uku': { class: 15, type: 'NPrePre15' }
        };

        // Verb extensions
        this.verbExtensions = {
            'el': 'ApplExt',
            'an': 'RecExt',
            'akal': 'NeutExt',
            'is': 'CausExt',
            'w': 'PassExt'
        };

        // Common morphemes
        this.commonMorphemes = {
            'nga': 'AdvPre',
            'ka': 'AdvPre',
            'na': 'AdvPre',
            'ku': 'LocPre',
            'e': 'LocPre',
            's': 'PreLoc-s',
            'wa': 'PossConc3',
            'ya': 'PossConc4',
            'za': 'PossConc10',
            'kwa': 'PossConc15',
            'ng': 'CopPre',
            'o': 'RelConc3',
            'ezi': 'RelConc10',
            'eli': 'RelConc5',
            'aba': 'RelConc2'
        };

        // Quantifiers
        this.quantifiers = {
            'dwa': 'QuantStem',
            'nye': 'AdjStem',
            'bili': 'AdjStem'
        };
    }

    initializeVocabulary() {
        // Common Zulu word stems and roots
        this.vocabulary = {
            'jongo': 'NStem',
            'konzo': 'NStem', 
            'website': 'Foreign',
            'Ningizimu': 'ProperName',
            'Afrika': 'ProperName',
            'thol': 'VRoot',
            'thombo': 'NStem',
            'azi': 'NStem',
            'hulumeni': 'NStem',
            'phungul': 'VRoot',
            'gebe': 'NStem',
            'khona': 'Adv',
            'phakathi': 'Adv',
            'ndla': 'NStem',
            'notho': 'NStem',
            'khakha': 'NStem',
            'qal': 'VRoot'
        };

        // Common verb roots
        this.verbRoots = [
            'thol', 'phungul', 'qal', 'phak', 'khon', 'fund', 'bon', 'sebenz', 'hlol'
        ];
    }

    analyzeWord(word) {
        const originalWord = word;
        const morphemes = [];
        let remaining = word.toLowerCase();

        // Handle punctuation
        if (/^[.,!?;:]$/.test(word)) {
            return [{ morph: word, tag: 'Punc' }];
        }

        // Check for known vocabulary first
        if (this.vocabulary[remaining]) {
            return [{ morph: remaining, tag: this.vocabulary[remaining] }];
        }

        // Check for proper names (capitalized)
        if (/^[A-Z]/.test(originalWord) && originalWord.length > 2) {
            return [{ morph: originalWord, tag: 'ProperName' }];
        }

        // Analyze morphemes step by step
        while (remaining.length > 0) {
            let found = false;

            // Check noun prefixes
            for (let prefix in this.nounPrefixes) {
                if (remaining.startsWith(prefix)) {
                    const prefixInfo = this.nounPrefixes[prefix];
                    morphemes.push({ morph: prefix.substring(0, 1), tag: prefixInfo.type });
                    
                    // Add basic prefix if needed
                    if (prefix.length > 1) {
                        const basicPrefix = this.getNounBasicPrefix(prefixInfo.class);
                        if (basicPrefix) {
                            morphemes.push({ morph: basicPrefix, tag: `BPre${prefixInfo.class}` });
                        }
                    }
                    
                    remaining = remaining.substring(prefix.length);
                    found = true;
                    break;
                }
            }

            if (found) continue;

            // Check common morphemes
            for (let morpheme in this.commonMorphemes) {
                if (remaining.startsWith(morpheme)) {
                    morphemes.push({ morph: morpheme, tag: this.commonMorphemes[morpheme] });
                    remaining = remaining.substring(morpheme.length);
                    found = true;
                    break;
                }
            }

            if (found) continue;

            // Check verb extensions
            for (let ext in this.verbExtensions) {
                if (remaining.includes(ext)) {
                    const index = remaining.indexOf(ext);
                    if (index > 0) {
                        // Add root before extension
                        const root = remaining.substring(0, index);
                        morphemes.push({ morph: root, tag: 'VRoot' });
                        morphemes.push({ morph: ext, tag: this.verbExtensions[ext] });
                        remaining = remaining.substring(index + ext.length);
                        found = true;
                        break;
                    }
                }
            }

            if (found) continue;

            // Check for verb termination
            if (remaining.endsWith('a') && remaining.length > 1) {
                const root = remaining.substring(0, remaining.length - 1);
                if (root.length > 0) {
                    morphemes.push({ morph: root, tag: 'VRoot' });
                    morphemes.push({ morph: 'a', tag: 'VerbTerm' });
                    remaining = '';
                    found = true;
                }
            }

            if (found) continue;

            // Check quantifiers
            for (let quant in this.quantifiers) {
                if (remaining === quant) {
                    morphemes.push({ morph: quant, tag: this.quantifiers[quant] });
                    remaining = '';
                    found = true;
                    break;
                }
            }

            if (found) continue;

            // If nothing matches, treat as stem
            morphemes.push({ morph: remaining, tag: 'NStem' });
            break;
        }

        return morphemes.length > 0 ? morphemes : [{ morph: originalWord, tag: 'Unknown' }];
    }

    getNounBasicPrefix(nounClass) {
        const basicPrefixes = {
            1: 'mu', 2: 'ba', 3: 'mu', 4: 'mi', 5: 'li', 6: 'ma',
            7: 'si', 8: 'zi', 9: 'n', 10: 'zin', 11: 'lu', 14: 'bu', 15: 'ku'
        };
        return basicPrefixes[nounClass];
    }

    formatMorphAnalysis(word, morphemes) {
        const parts = morphemes.map(m => `${m.morph}[${m.tag}]`);
        return parts.join('-');
    }

    analyzeText(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const results = [];

        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            const words = line.trim().split(/\s+/);
            const analyzedWords = [];

            words.forEach(word => {
                const morphemes = this.analyzeWord(word);
                const analysis = this.formatMorphAnalysis(word, morphemes);
                analyzedWords.push(analysis);
            });

            results.push(`<LINE ${lineNumber}>${analyzedWords.join(' ')}`);
        });

        return results.join('\n');
    }
}

// Text extraction utilities
class TextExtractor {
    static async extractFromFile(buffer, filename, mimetype) {
        const extension = path.extname(filename).toLowerCase();
        
        try {
            switch (extension) {
                case '.txt':
                    return buffer.toString('utf-8');
                
                case '.pdf':
                    const pdfData = await pdf(buffer);
                    return pdfData.text;
                
                case '.doc':
                case '.docx':
                    const docData = await mammoth.extractRawText({ buffer });
                    return docData.value;
                
                case '.json':
                    const jsonData = JSON.parse(buffer.toString('utf-8'));
                    return JSON.stringify(jsonData, null, 2);
                
                case '.csv':
                    return buffer.toString('utf-8');
                
                default:
                    throw new Error(`Unsupported file type: ${extension}`);
            }
        } catch (error) {
            throw new Error(`Failed to extract text from ${filename}: ${error.message}`);
        }
    }
}

// Initialize the analyzer
const zuluAnalyzer = new ZuluMorphAnalyzer();

// Routes
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Zulu NLP Processing System',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        features: [
            'Text extraction from PDF, DOC, TXT, JSON, CSV',
            'Zulu morphological analysis',
            'Batch file processing',
            'Multi-format export'
        ]
    });
});

// Single text processing endpoint
app.post('/api/process-text', async (req, res) => {
    try {
        const { text, options = {} } = req.body;
        
        if (!text) {
            return res.status(400).json({
                success: false,
                error: 'No text provided for analysis'
            });
        }

        console.log('Processing text:', text.substring(0, 100) + '...');
        
        const morphAnalysis = zuluAnalyzer.analyzeText(text);
        
        const result = {
            success: true,
            original_text: text,
            morphological_analysis: morphAnalysis,
            analysis_metadata: {
                lines_processed: morphAnalysis.split('\n').length,
                processing_time: new Date().toISOString(),
                analyzer_version: '1.0.0'
            }
        };

        res.json(result);
        
    } catch (error) {
        console.error('Text processing error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// File upload and processing endpoint
app.post('/api/process-files', upload.array('files', 10), async (req, res) => {
    try {
        const files = req.files;
        const options = req.body.options ? JSON.parse(req.body.options) : {};
        
        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded'
            });
        }

        console.log(`Processing ${files.length} files...`);
        
        const results = [];
        
        for (const file of files) {
            try {
                console.log(`Extracting text from: ${file.originalname}`);
                
                // Extract text from file
                const extractedText = await TextExtractor.extractFromFile(
                    file.buffer, 
                    file.originalname, 
                    file.mimetype
                );
                
                console.log(`Analyzing text from: ${file.originalname}`);
                
                // Perform morphological analysis
                const morphAnalysis = zuluAnalyzer.analyzeText(extractedText);
                
                const fileResult = {
                    filename: file.originalname,
                    size: file.size,
                    type: file.mimetype,
                    status: 'completed',
                    extracted_text: extractedText,
                    morphological_analysis: morphAnalysis,
                    word_count: extractedText.split(/\s+/).length,
                    line_count: extractedText.split('\n').length,
                    processing_timestamp: new Date().toISOString()
                };
                
                results.push(fileResult);
                
            } catch (fileError) {
                console.error(`Error processing file ${file.originalname}:`, fileError);
                
                results.push({
                    filename: file.originalname,
                    size: file.size,
                    type: file.mimetype,
                    status: 'failed',
                    error: fileError.message,
                    processing_timestamp: new Date().toISOString()
                });
            }
        }
        
        const response = {
            success: true,
            processed_files: results,
            summary: {
                total_files: files.length,
                successful: results.filter(r => r.status === 'completed').length,
                failed: results.filter(r => r.status === 'failed').length,
                processing_time: new Date().toISOString()
            }
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('File processing error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Batch text processing endpoint
app.post('/api/process-batch', async (req, res) => {
    try {
        const { texts, options = {} } = req.body;
        
        if (!texts || !Array.isArray(texts)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid texts array provided'
            });
        }

        console.log(`Processing batch of ${texts.length} texts...`);
        
        const results = texts.map((text, index) => {
            const morphAnalysis = zuluAnalyzer.analyzeText(text);
            
            return {
                index: index,
                original_text: text,
                morphological_analysis: morphAnalysis,
                word_count: text.split(/\s+/).length,
                line_count: text.split('\n').length
            };
        });
        
        res.json({
            success: true,
            results: results,
            summary: {
                total_texts: texts.length,
                total_words: results.reduce((sum, r) => sum + r.word_count, 0),
                total_lines: results.reduce((sum, r) => sum + r.line_count, 0),
                processing_time: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Batch processing error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Export results endpoint
app.post('/api/export', async (req, res) => {
    try {
        const { data, format } = req.body;
        
        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'No data provided for export'
            });
        }
        
        let exportData;
        let contentType;
        let filename;
        
        switch (format) {
            case 'csv':
                exportData = convertToCSV(data);
                contentType = 'text/csv';
                filename = 'zulu_analysis_results.csv';
                break;
                
            case 'json':
                exportData = JSON.stringify(data, null, 2);
                contentType = 'application/json';
                filename = 'zulu_analysis_results.json';
                break;
                
            case 'txt':
                exportData = convertToText(data);
                contentType = 'text/plain';
                filename = 'zulu_analysis_results.txt';
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Unsupported export format'
                });
        }
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exportData);
        
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Utility functions for export
function convertToCSV(data) {
    const headers = [
        'Filename', 'Size', 'Type', 'Status', 'Word_Count', 'Line_Count', 
        'Extracted_Text_Preview', 'Morphological_Analysis_Preview', 'Processing_Time'
    ];
    
    const rows = [headers.join(',')];
    
    if (Array.isArray(data)) {
        data.forEach(item => {
            const row = [
                `"${item.filename || 'N/A'}"`,
                item.size || 0,
                `"${item.type || 'N/A'}"`,
                `"${item.status || 'N/A'}"`,
                item.word_count || 0,
                item.line_count || 0,
                `"${(item.extracted_text || '').substring(0, 100).replace(/"/g, '""')}..."`,
                `"${(item.morphological_analysis || '').substring(0, 100).replace(/"/g, '""')}..."`,
                `"${item.processing_timestamp || 'N/A'}"`
            ];
            rows.push(row.join(','));
        });
    }
    
    return rows.join('\n');
}

function convertToText(data) {
    let text = 'ZULU MORPHOLOGICAL ANALYSIS RESULTS\n';
    text += '=' .repeat(50) + '\n\n';
    
    if (Array.isArray(data)) {
        data.forEach((item, index) => {
            text += `FILE ${index + 1}: ${item.filename || 'Unknown'}\n`;
            text += '-'.repeat(30) + '\n';
            text += `Size: ${item.size || 0} bytes\n`;
            text += `Type: ${item.type || 'Unknown'}\n`;
            text += `Status: ${item.status || 'Unknown'}\n`;
            text += `Words: ${item.word_count || 0}\n`;
            text += `Lines: ${item.line_count || 0}\n\n`;
            
            if (item.morphological_analysis) {
                text += 'MORPHOLOGICAL ANALYSIS:\n';
                text += item.morphological_analysis + '\n\n';
            }
            
            text += '\n' + '='.repeat(50) + '\n\n';
        });
    }
    
    return text;
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Zulu NLP Processing Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    console.log('✅ Ready to process Zulu text files!');
});