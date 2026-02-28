import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Allowed MIME types for document analysis
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/tiff',
  'text/plain', 'text/csv', 'text/html',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      console.error('Authentication failed:', userErr);
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Document analysis requested');

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const supplierId = formData.get('supplierId') as string;
    
    if (!file || !supplierId) {
      return new Response(
        JSON.stringify({ error: 'File and supplier ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-side file validation
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return new Response(
        JSON.stringify({ error: `File type "${file.type}" is not allowed` }),
        { status: 415, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get supplier details for context
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('company_name, industry, description')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      return new Response(
        JSON.stringify({ error: 'Supplier not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileName = file.name;
    const fileType = file.type;
    const fileSize = file.size;

    // Clean document name from filename
    const cleanedName = fileName
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
      .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words

    let extractedText = '';
    let analysisPrompt = '';

    if (fileType.includes('image')) {
      // For images, use OpenAI Vision API
      const fileBytes = await file.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(fileBytes)));
      const imageUrl = `data:${fileType};base64,${base64Image}`;

      const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text content from this document image. Also identify if there are any dates that could be expiration dates, effective dates, or validity periods.'
                },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl }
                }
              ]
            }
          ],
          max_tokens: 1000
        })
      });

      const visionData = await visionResponse.json();
      extractedText = visionData.choices?.[0]?.message?.content || '';
    } else {
      // For text files, read content directly
      extractedText = await file.text();
    }

    // Available categories for validation
    const availableCategories = [
      'Certificate',
      'Insurance', 
      'Financial',
      'Legal',
      'Quality',
      'Safety',
      'Environmental',
      'Compliance',
      'Training',
      'Policy',
      'Technical',
      'Other'
    ];

    // Analyze content with AI for suggestions
    analysisPrompt = `
    Analyze this document for a supplier company with the following context:
    - Company: ${supplier.company_name}
    - Industry: ${supplier.industry || 'Unknown'}
    - Description: ${supplier.description || 'Not provided'}
    
    Document filename: ${fileName}
    Document content: ${extractedText.substring(0, 2000)}
    
    Please provide a JSON response with:
    1. "suggestedCategory": Choose the BEST category from this EXACT list: ${availableCategories.join(', ')}
    2. "suggestedTags": Array of 3-5 relevant tags
    3. "suggestedDescription": Brief, professional description (max 150 chars)
    4. "potentialExpirationDate": If you find any date that could be an expiration date, return it in YYYY-MM-DD format, otherwise null
    5. "confidence": Your confidence level (0-1) in the suggestions
    
    IMPORTANT: You MUST choose suggestedCategory from the provided list exactly as written. Do not use any other category names.
    Focus on business compliance and supplier relationship context.
    `;

    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert document analyzer. Always respond with valid JSON only.' },
          { role: 'user', content: analysisPrompt }
        ],
        max_tokens: 500
      })
    });

    const analysisData = await analysisResponse.json();
    let aiSuggestions = {};

    try {
      const responseText = analysisData.choices?.[0]?.message?.content || '{}';
      aiSuggestions = JSON.parse(responseText);
      
      // Validate category and fallback to 'Other' if invalid
      if (aiSuggestions.suggestedCategory && !availableCategories.includes(aiSuggestions.suggestedCategory)) {
        console.warn(`Invalid category suggested: ${aiSuggestions.suggestedCategory}, using 'Other' instead`);
        aiSuggestions.suggestedCategory = 'Other';
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      // Fallback suggestions
      aiSuggestions = {
        suggestedCategory: 'Other',
        suggestedTags: ['document'],
        suggestedDescription: 'Document uploaded for review',
        potentialExpirationDate: null,
        confidence: 0.3
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          cleanedName,
          extractedText: extractedText.substring(0, 1000), // Limit for response size
          fileInfo: {
            name: fileName,
            type: fileType,
            size: fileSize
          },
          ...aiSuggestions
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in document-analyzer:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to analyze document', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});