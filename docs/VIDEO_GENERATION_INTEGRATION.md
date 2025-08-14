# Video Generation Config Integration

This document outlines the complete integration of the new "video_generation" config type with Novita AI's Kling v1.6 Text-to-Video API.

## Overview

The video generation config type extends your existing RAG system to create AI-powered videos from knowledge base content. It follows the same architecture patterns as your existing "normal" and "survey" config types.

## Files Created

### Backend Files
- `backend/routes/video_config_routes.py` - CRUD operations for video generation configs
- `backend/routes/video_generation_routes.py` - Video generation API integration
- `backend/src/utils/config.py` - Updated to include NOVITA_API_KEY
- `backend/app.py` - Updated to register new blueprints

### Frontend Files
- `frontend/src/pages/VideoConfigPage.jsx` - Configuration form for video generation
- `frontend/src/pages/VideoGenerationPage.jsx` - Video generation interface
- `frontend/src/App.jsx` - Updated routing
- `frontend/src/pages/ConfigList.jsx` - Updated to display video configs

### Documentation Files
- `docs/video_generation_schema.json` - JSON schema for video generation configs
- `docs/example_mitochondria_video_config.json` - Example configuration
- `docs/VIDEO_GENERATION_INTEGRATION.md` - This documentation

## Configuration Schema

The video generation config includes these fields:

```json
{
  "bot_name": "string (required)",
  "prompt_template": "string with {{context}} and {{query}} placeholders (required)",
  "collection_name": "string (required)",
  "is_public": "boolean (default: false)",
  "mode": "string (enum: ['Standard'], default: 'Standard')",
  "duration": "integer (enum: [5, 10], default: 5)",
  "guidance_scale": "float (0.0-1.0, default: 0.5)",
  "negative_prompt": "string (comma-separated)",
  "negative_prompt_list": "array of strings (for UI)"
}
```

## API Endpoints

### Video Config Management
- `GET /api/video_config_list` - List user's video configs
- `GET /api/video_config/<config_id>` - Get single video config
- `POST /api/video_config` - Create new video config

### Video Generation
- `POST /api/generate_video/<config_id>` - Generate video from query
- `GET /api/check_task/<task_id>` - Check video generation status

## Pipeline Flow

1. **User Input**: User provides a query on the VideoGenerationPage
2. **Context Retrieval**: System retrieves relevant documents from knowledge base using HNSW vector search
3. **Prompt Injection**: Context and query are injected into the prompt template
4. **API Call**: Final prompt is sent to Novita Kling v1.6 API with video parameters
5. **Polling**: System polls for completion and returns video URL when ready

## Environment Variables

Add to your `.env` file:
```
NOVITA_API_KEY=your_novita_api_key_here
```

## Frontend Integration

### New Routes Added
- `/video-config` - Video configuration form
- `/video-generation/:configId` - Video generation interface

### ConfigList Updates
- Loads video configs alongside normal and survey configs
- Displays video-specific metadata (mode, duration, guidance scale)
- Routes to video generation page when video config is selected
- Added "Video Generator" option to assistant type modal

## Usage Example

1. **Create Config**: User clicks "New Assistant" → "Video Generator"
2. **Configure**: User fills out VideoConfigPage form with:
   - Name: "Mitochondria Video Generator"
   - Prompt template: "Create educational video showing {{context}} based on {{query}}"
   - Upload biology documents
   - Set duration: 10 seconds
   - Select negative prompts: Blurry, Cartoonish
3. **Generate**: User navigates to video generation page and enters query
4. **Result**: System returns generated video URL

## Technical Architecture

### Shared Components Reused
- Vector store processing (`store_vector_stores.py`)
- MongoDB Atlas HNSW search with config_id filtering
- Authentication and authorization patterns
- File upload handling

### New Components
- Novita API integration with async polling
- Video-specific parameter validation
- Negative prompt checklist UI component
- Video player and download functionality

## Error Handling

The system handles various error scenarios:
- Invalid Novita API responses
- Video generation timeouts (5-minute limit)
- Missing API keys
- Invalid config parameters
- Network failures during polling

## Security Considerations

- NOVITA_API_KEY stored securely in environment variables
- Same authentication patterns as existing config types
- Public/private config access control maintained
- Input validation for all video parameters

## Testing

To test the integration:

1. Set NOVITA_API_KEY in your environment
2. Start the backend server
3. Navigate to the frontend and create a video generation config
4. Upload some documents and test video generation
5. Verify the generated video URL is accessible

## Future Enhancements

Potential improvements:
- Support for additional Kling API modes
- Video preview thumbnails
- Batch video generation
- Custom negative prompt options
- Video quality settings
- Integration with other video generation APIs
