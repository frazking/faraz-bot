/**
 * WASI-TEC - Technical Core Module
 * Advanced Technical Operations Handler
 * © ITXXWASI Technical Division
 * 
 * handles all api calls and media processing
 * built this to centralize all external requests - wasi
 */

const axios = require('axios'); // for http requests
const FormData = require('form-data'); // for file uploads

class WasiTec {
    constructor() {
        // my api endpoints - primary and backup
        this.apiEndpoints = {
            primary: 'https://api.wasi-tech.com/v7',
            secondary: 'https://backup.wasi-tech.com/v7',
            cdn: 'https://cdn.wasi-tech.com' // for media uploads
        };
        
        // cache to avoid repeated api calls - wasi
        this.cache = new Map();
        this.rateLimiter = new Map(); // prevent api abuse
    }
    
    async fetchAPI(endpoint, params = {}) {
        const cacheKey = `${endpoint}-${JSON.stringify(params)}`;
        
        // Check cache first - saves api calls
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) { // 5 min cache
                return cached.data; // return cached data
            }
        }
        
        // Rate limiting check - dont spam the api
        if (this.isRateLimited(endpoint)) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }
        
        try {
            // try primary endpoint first
            const response = await axios.get(`${this.apiEndpoints.primary}${endpoint}`, {
                params,
                headers: {
                    'User-Agent': 'FRAZ-BOT',
                    'X-API-Key': process.env.WASI_API_KEY || 'default'
                },
                timeout: 30000 // 30 second timeout
            });
            
            // Cache the response for next time - wasi
            this.cache.set(cacheKey, {
                data: response.data,
                timestamp: Date.now()
            });
            
            return response.data;
            
        } catch (error) {
            // Try secondary endpoint if primary fails
            try {
                const response = await axios.get(`${this.apiEndpoints.secondary}${endpoint}`, {
                    params,
                    timeout: 30000
                });
                return response.data;
            } catch (err) {
                throw new Error(`API request failed: ${error.message}`);
            }
        }
    }
    
    isRateLimited(endpoint) {
        const key = `ratelimit-${endpoint}`;
        const limit = this.rateLimiter.get(key);
        
        if (!limit) {
            this.rateLimiter.set(key, {
                count: 1,
                resetTime: Date.now() + 60000 // 1 minute
            });
            return false;
        }
        
        if (Date.now() > limit.resetTime) {
            this.rateLimiter.set(key, {
                count: 1,
                resetTime: Date.now() + 60000
            });
            return false;
        }
        
        if (limit.count >= 30) { // 30 requests per minute
            return true;
        }
        
        limit.count++;
        return false;
    }
    
    async downloadMedia(url) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 60000
            });
            return Buffer.from(response.data);
        } catch (error) {
            throw new Error(`Media download failed: ${error.message}`);
        }
    }
    
    async uploadMedia(buffer, filename) {
        const form = new FormData();
        form.append('file', buffer, filename);
        
        try {
            const response = await axios.post(`${this.apiEndpoints.cdn}/upload`, form, {
                headers: form.getHeaders(),
                timeout: 120000
            });
            return response.data.url;
        } catch (error) {
            throw new Error(`Media upload failed: ${error.message}`);
        }
    }
    
    async processImage(buffer, options = {}) {
        const form = new FormData();
        form.append('image', buffer);
        form.append('options', JSON.stringify(options));
        
        try {
            const response = await axios.post(`${this.apiEndpoints.primary}/process-image`, form, {
                headers: form.getHeaders(),
                responseType: 'arraybuffer',
                timeout: 60000
            });
            return Buffer.from(response.data);
        } catch (error) {
            throw new Error(`Image processing failed: ${error.message}`);
        }
    }
    
    async textToSpeech(text, lang = 'en') {
        try {
            const response = await this.fetchAPI('/tts', { text, lang });
            return response.audioUrl;
        } catch (error) {
            throw new Error(`TTS failed: ${error.message}`);
        }
    }
    
    async translate(text, from, to) {
        try {
            const response = await this.fetchAPI('/translate', { text, from, to });
            return response.translation;
        } catch (error) {
            throw new Error(`Translation failed: ${error.message}`);
        }
    }
    
    clearCache() {
        this.cache.clear();
        this.rateLimiter.clear();
    }
}

module.exports = new WasiTec();
