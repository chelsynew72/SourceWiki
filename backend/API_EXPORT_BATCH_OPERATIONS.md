# Export & Batch Operations API Documentation

This document provides detailed information about the new export and batch operation features added to the WikiSource Verifier platform.

## Table of Contents

- [Export Functionality](#export-functionality)
- [Batch Operations](#batch-operations)
- [Request Examples](#request-examples)
- [Response Examples](#response-examples)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

## Export Functionality

### Overview
Admin users can export submission data in both CSV and JSON formats with comprehensive filtering options.

### Endpoints

#### 1. Export Submissions
```
GET /api/admin/submissions/export
```

**Authentication Required:** Admin role

**Query Parameters:**
- `format` (string, optional): Output format - 'csv' or 'json' (default: 'json')
- `status` (string, optional): Filter by status - 'pending', 'approved', 'rejected'
- `category` (string, optional): Filter by category - 'primary', 'secondary', 'unreliable'
- `country` (string, optional): Filter by country name
- `dateFrom` (string, optional): ISO 8601 date format (YYYY-MM-DD)
- `dateTo` (string, optional): ISO 8601 date format (YYYY-MM-DD)
- `search` (string, optional): Search in title, publisher, or URL
- `submitter` (string, optional): MongoDB ObjectId of submitter
- `limit` (integer, optional): Maximum records to export (1-10000, default: 1000)
- `offset` (integer, optional): Number of records to skip (0-100000, default: 0)

#### 2. Export Preview
```
GET /api/admin/submissions/export/preview
```

**Authentication Required:** Admin role

**Query Parameters:** Same as export endpoint (except format, limit, offset)

Returns a preview of data that would be exported without actually generating the file.

## Batch Operations

### Overview
Admin users can perform batch operations on multiple submissions simultaneously.

### Endpoint
```
POST /api/admin/submissions/batch
```

**Authentication Required:** Admin role

**Request Body:**
```json
{
  "action": "approve|reject|delete|update",
  "submissionIds": ["optional_array_of_ids"],
  "filters": {
    "optional_object_with_filters"
  },
  "updateData": {
    "optional_object_with_update_fields"
  },
  "batchNotes": "optional_admin_notes"
}
```

#### Actions

##### 1. Approve
Approve multiple pending submissions with credibility rating.

**Required Fields:**
- `action`: "approve"
- `updateData.credibility`: "credible" or "unreliable"

**Optional Fields:**
- `submissionIds`: Array of submission IDs
- `filters`: Object with filtering criteria
- `batchNotes`: Admin notes for all submissions

##### 2. Reject
Reject multiple pending submissions.

**Required Fields:**
- `action`: "reject"

**Optional Fields:**
- `submissionIds`: Array of submission IDs
- `filters`: Object with filtering criteria
- `batchNotes`: Admin notes for all submissions
- `updateData.verifierNotes`: Notes for rejected submissions

##### 3. Delete
Permanently delete multiple submissions.

**Required Fields:**
- `action`: "delete"

**Optional Fields:**
- `submissionIds`: Array of submission IDs
- `filters`: Object with filtering criteria
- `batchNotes`: Admin notes

##### 4. Update
Bulk update submission metadata.

**Required Fields:**
- `action`: "update"
- `updateData`: Object with fields to update

**Updateable Fields:**
- `category`: "primary", "secondary", or "unreliable"
- `wikipediaArticle`: String (max 500 chars)
- `verifierNotes`: String (max 500 chars)

## Request Examples

### Export CSV - Filter by Status and Date Range
```bash
GET /api/admin/submissions/export?format=csv&status=approved&dateFrom=2024-01-01&dateTo=2024-12-31&limit=5000
```

### Export JSON - Filter by Country and Category
```bash
GET /api/admin/submissions/export?format=json&country=USA&category=primary&search=health
```

### Batch Approve Submissions
```bash
POST /api/admin/submissions/batch
Content-Type: application/json

{
  "action": "approve",
  "submissionIds": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013"
  ],
  "updateData": {
    "credibility": "credible",
    "verifierNotes": "Approved in batch operation - high quality source"
  },
  "batchNotes": "Monthly quality review - approved credible sources"
}
```

### Batch Reject Using Filters
```bash
POST /api/admin/submissions/batch
Content-Type: application/json

{
  "action": "reject",
  "filters": {
    "status": "pending",
    "category": "unreliable",
    "dateFrom": "2024-01-01",
    "dateTo": "2024-01-31"
  },
  "batchNotes": "Batch rejection of low-quality submissions from January"
}
```

### Batch Update Categories
```bash
POST /api/admin/submissions/batch
Content-Type: application/json

{
  "action": "update",
  "filters": {
    "category": "secondary"
  },
  "updateData": {
    "category": "primary"
  }
}
```

## Response Examples

### Export Response (JSON)
```json
{
  "success": true,
  "exportDate": "2024-01-15T10:30:00.000Z",
  "totalRecords": 150,
  "filters": {
    "status": "approved",
    "dateFrom": "2024-01-01",
    "dateTo": "2024-01-31"
  },
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "url": "https://example.com/article1",
      "title": "Example Article 1",
      "publisher": "Example Publisher",
      "country": "USA",
      "category": "primary",
      "status": "approved",
      "credibility": "credible",
      "submittedDate": "2024-01-10T08:00:00.000Z",
      "verifiedAt": "2024-01-12T14:30:00.000Z",
      "submitter": "user123",
      "submitterEmail": "user123@example.com",
      "verifier": "admin456",
      "wikipediaArticle": "",
      "verifierNotes": "High quality source",
      "fileType": "url",
      "tags": "health, science",
      "createdAt": "2024-01-10T08:00:00.000Z",
      "updatedAt": "2024-01-12T14:30:00.000Z"
    }
  ]
}
```

### Export Response (CSV)
```csv
ID,URL,Title,Publisher,Country,Category,Status,Credibility,Submitted Date,Verified Date,Submitter,Submitter Email,Verifier,Verifier Email,Wikipedia Article,Verifier Notes,File Type,Tags,Created At,Updated At
507f1f77bcf86cd799439011,"https://example.com/article1","Example Article 1","Example Publisher",USA,primary,approved,credible,2024-01-10,2024-01-12,user123,user123@example.com,admin456,admin@example.com,"","High quality source",url,"health, science",2024-01-10T08:00:00.000Z,2024-01-12T14:30:00.000Z
```

### Batch Operation Response
```json
{
  "success": true,
  "action": "approve",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "performedBy": "admin456",
  "results": {
    "totalProcessed": 25,
    "successful": [
      {
        "id": "507f1f77bcf86cd799439011",
        "action": "approved",
        "credibility": "credible"
      },
      {
        "id": "507f1f77bcf86cd799439012",
        "action": "approved",
        "credibility": "credible"
      }
    ],
    "failed": [
      {
        "id": "507f1f77bcf86cd799439013",
        "reason": "Submission is not in pending status"
      }
    ],
    "summary": {
      "totalProcessed": 25,
      "successful": 24,
      "failed": 1,
      "successRate": "96.00%"
    }
  }
}
```

### Export Preview Response
```json
{
  "success": true,
  "filters": {
    "status": "approved",
    "country": "USA"
  },
  "totalMatchingRecords": 1250,
  "previewRecords": 10,
  "previewData": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "title": "Example Article",
      "publisher": "Example Publisher",
      "country": "USA",
      "status": "approved",
      "createdAt": "2024-01-10T08:00:00.000Z",
      "submitter": {
        "username": "user123",
        "country": "USA"
      }
    }
  ]
}
```

## Error Handling

### Validation Errors
```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "Validation failed",
  "errors": [
    {
      "field": "action",
      "message": "Action must be approve, reject, delete, or update"
    },
    {
      "field": "updateData.credibility",
      "message": "Credibility must be credible or unreliable"
    }
  ]
}
```

### Resource Not Found
```json
{
  "success": false,
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "No submissions found matching the criteria"
}
```

### Authorization Error
```json
{
  "success": false,
  "errorCode": "UNAUTHORIZED_ACCESS",
  "message": "Access denied. Admin role required."
}
```

## Rate Limiting

### Export Operations
- **Limit**: 10 exports per hour per admin user
- **Scope**: Applies to both preview and actual export requests

### Batch Operations
- **Limit**: 5 batch operations per hour per admin user
- **Scope**: All batch actions (approve, reject, delete, update)

### Error Response for Rate Limiting
```json
{
  "success": false,
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 3600
}
```

## Security Considerations

1. **Admin Access Only**: All export and batch operations require admin role
2. **Data Sanitization**: All exported data is properly escaped to prevent CSV injection
3. **Audit Trail**: All batch operations are logged with admin user and timestamp
4. **Input Validation**: Comprehensive validation on all input parameters
5. **Rate Limiting**: Implemented to prevent abuse

## Best Practices

1. **Use Preview First**: Always use the preview endpoint to verify filters before exporting
2. **Start Small**: Begin with smaller batches and limits, then increase as needed
3. **Monitor Operations**: Check the success rate in batch operation responses
4. **Backup Data**: Export data before performing large batch operations
5. **Review Logs**: Regularly audit batch operation logs for compliance

## Migration Notes

### New Dependencies
- No new external dependencies required
- Uses native MongoDB ObjectId validation

### Database Changes
- No database schema changes required
- All operations work with existing data structure

### API Changes
- New endpoints added to existing admin routes
- Backward compatible - no breaking changes to existing APIs

## Troubleshooting

### Common Issues

1. **Large Export Timeouts**
   - Reduce `limit` parameter
   - Use `offset` for pagination
   - Apply more specific filters

2. **Batch Operation Failures**
   - Check individual submission statuses
   - Verify update data format
   - Ensure proper admin permissions

3. **Validation Errors**
   - Verify MongoDB ObjectId format
   - Check date format (ISO 8601)
   - Confirm enum values match expected options

### Support
For technical support or questions about these features, contact the development team or refer to the main API documentation.
