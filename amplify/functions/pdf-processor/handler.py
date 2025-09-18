import json
import base64
import boto3
import uuid
from typing import Dict, Any

def extract_patient_data_with_claude_pdf_support(pdf_content: str) -> Dict[str, str]:
    """Extract patient data from PDF using Claude's native PDF support via Bedrock converse API."""
    try:
        print("🚀 Starting Claude PDF support extraction...")
        print(f"📄 PDF content length: {len(pdf_content)} characters")
        
        # Initialize Bedrock client
        print("🔧 Initializing Bedrock client...")
        bedrock = boto3.client('bedrock-runtime', region_name='us-west-2')
        print("✅ Bedrock client initialized")
        
        # Decode base64 PDF content to bytes
        print("🔄 Decoding PDF content...")
        pdf_bytes = base64.b64decode(pdf_content)
        print(f"📄 PDF bytes length: {len(pdf_bytes)} bytes")
        
        # Validate PDF header
        if pdf_bytes.startswith(b'%PDF-'):
            print("✅ Valid PDF header detected")
            # Get PDF version for debugging
            pdf_version = pdf_bytes[:8].decode('utf-8', errors='ignore')
            print(f"📋 PDF version: {pdf_version}")
        else:
            print("❌ Invalid PDF header - not a valid PDF file")
            return {'debugInfo': 'Invalid PDF file - missing PDF header', 'firstName': '', 'lastName': '', 'dateOfBirth': ''}
        
        # Additional PDF diagnostics
        print(f"📊 PDF size: {len(pdf_bytes)} bytes ({len(pdf_bytes)/1024/1024:.2f} MB)")
        print(f"🔍 First 100 bytes: {pdf_bytes[:100]}")
        print(f"🔍 Last 100 bytes: {pdf_bytes[-100:]}")
        
        # Check for common PDF issues
        if b'stream' in pdf_bytes:
            print("✅ PDF contains stream objects")
        else:
            print("⚠️ PDF may not contain stream objects")
            
        if b'endstream' in pdf_bytes:
            print("✅ PDF contains endstream markers")
        else:
            print("⚠️ PDF may be missing endstream markers")
        
        # Check PDF version and add warnings for older versions
        if "1.3" in pdf_version:
            print("⚠️ PDF version 1.3 detected - this is an older format that may have compatibility issues")
        elif "1.4" in pdf_version:
            print("⚠️ PDF version 1.4 detected - older format")
        else:
            print(f"✅ PDF version {pdf_version} - modern format")
        
        # Create conversation with PDF document using Claude's native PDF support
        print("📝 Creating conversation with PDF document using Claude PDF support...")
        
        # Use different approach for older PDF versions
        if "1.3" in pdf_version:
            print("🔄 Using simplified approach for PDF 1.3...")
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "text": "Please analyze this PDF document and extract patient information. Look for names and dates. Respond with JSON: {\"debugInfo\": \"what you can see\", \"firstName\": \"\", \"lastName\": \"\", \"dateOfBirth\": \"\"}"
                        },
                        {
                            "document": {
                                "format": "pdf",
                                "name": "medicalDocument",
                                "source": {"bytes": pdf_bytes}
                            }
                        }
                    ]
                }
            ]
        else:
            print("🔄 Using standard approach for modern PDF...")
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "text": """You are a medical document analysis AI specialized in extracting patient information from healthcare documents.

IMPORTANT: First, please explain what you can see in the document. Describe the content, structure, and any information you can read. This will help us understand if the PDF is being processed correctly.

Then, extract the following patient information and respond with a JSON object containing:

Required JSON structure:
{
    "debugInfo": "Brief description of what you can see in the document",
    "firstName": "extracted first name or empty string if not found",
    "lastName": "extracted last name or empty string if not found", 
    "dateOfBirth": "extracted date of birth in YYYY-MM-DD format or empty string if not found"
}

EXTRACTION RULES:
- firstName: Look for "First Name", "Given Name", "Patient Name", "Name" fields, or any clear first name indicators
- lastName: Look for "Last Name", "Surname", "Family Name" fields, or the second part of full names
- dateOfBirth: Look for "Date of Birth", "DOB", "Birth Date", "Born" fields in various date formats
- Convert all dates to YYYY-MM-DD format (e.g., 01/15/1990 → 1990-01-15, Jan 15, 1990 → 1990-01-15)
- Be thorough in your search through the entire document
- If you cannot find any of these fields, use an empty string for that field
- Look for variations in field names and formats
- Consider both structured forms and unstructured text

Please analyze the document and respond with the JSON object."""
                        },
                        {
                            "document": {
                                "format": "pdf",
                                "name": "patientDocument",
                                "source": {"bytes": pdf_bytes}
                            }
                        }
                    ]
                }
            ]

        # Use Claude's converse API with native PDF support
        print("🤖 Calling Claude 3.5 Sonnet with native PDF support...")
        print(f"📊 Message structure: {len(messages)} messages")
        print(f"📊 Document size in message: {len(pdf_bytes)} bytes")
        
        response = bedrock.converse(
            modelId='anthropic.claude-3-5-sonnet-20241022-v2:0',
            messages=messages,
            inferenceConfig={
                "maxTokens": 2000,
                "temperature": 0.1
            }
        )
        print("✅ Bedrock response received")
        
        # Parse response
        print("📥 Parsing Bedrock response...")
        claude_response = response['output']['message']['content'][0]['text']
        print(f"📄 Claude response length: {len(claude_response)} characters")
        print(f"📄 Claude response preview: {claude_response[:200]}...")
        
        # Check if Claude reports the document as empty
        if "empty" in claude_response.lower() or "blank" in claude_response.lower():
            print("⚠️ Claude reports document as empty/blank - trying alternative approaches...")
            
            # Try multiple alternative approaches
            alternative_approaches = [
                {
                    "name": "Simplified prompt",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "text": "Extract patient information from this PDF. Look for names and dates. Respond with JSON: {\"debugInfo\": \"description\", \"firstName\": \"\", \"lastName\": \"\", \"dateOfBirth\": \"\"}"
                                },
                                {
                                    "document": {
                                        "format": "pdf",
                                        "name": "patientFile",
                                        "source": {"bytes": pdf_bytes}
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    "name": "Different model",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "text": "Analyze this PDF and extract patient data. Respond with JSON: {\"debugInfo\": \"what you see\", \"firstName\": \"\", \"lastName\": \"\", \"dateOfBirth\": \"\"}"
                                },
                                {
                                    "document": {
                                        "format": "pdf",
                                        "name": "medicalRecord",
                                        "source": {"bytes": pdf_bytes}
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
            
            for i, approach in enumerate(alternative_approaches):
                try:
                    print(f"🔄 Trying alternative approach {i+1}: {approach['name']}...")
                    
                    alt_response = bedrock.converse(
                        modelId='anthropic.claude-3-5-sonnet-20241022-v2:0',
                        messages=approach['messages'],
                        inferenceConfig={
                            "maxTokens": 2000,
                            "temperature": 0.1
                        }
                    )
                    
                    alt_claude_response = alt_response['output']['message']['content'][0]['text']
                    print(f"🔄 Alternative {i+1} response: {alt_claude_response[:200]}...")
                    
                    # Check if this approach worked better
                    if "empty" not in alt_claude_response.lower() and "blank" not in alt_claude_response.lower():
                        print(f"✅ Alternative approach {i+1} succeeded!")
                        claude_response = alt_claude_response
                        break
                    else:
                        print(f"⚠️ Alternative approach {i+1} also reported empty document")
                        
                except Exception as alt_e:
                    print(f"⚠️ Alternative approach {i+1} failed: {alt_e}")
                    continue
        
        # Extract JSON from Claude's response
        print("🔍 Extracting JSON from Claude response...")
        try:
            # Find JSON in the response
            json_start = claude_response.find('{')
            json_end = claude_response.rfind('}') + 1
            
            if json_start == -1 or json_end == 0:
                print("❌ No JSON found in Claude response")
                print(f"Full response: {claude_response}")
                return {'debugInfo': f'No JSON response from Claude. Response: {claude_response[:200]}', 'firstName': '', 'lastName': '', 'dateOfBirth': ''}
            
            json_str = claude_response[json_start:json_end]
            print(f"📋 Extracted JSON string: {json_str}")
            
            patient_data = json.loads(json_str)
            print(f"✅ Successfully parsed patient data: {patient_data}")
            
            # Print debug info if available
            if 'debugInfo' in patient_data:
                print(f"🔍 Claude debug info: {patient_data['debugInfo']}")
            
            return patient_data
            
        except (json.JSONDecodeError, ValueError) as e:
            print(f"❌ Error parsing Claude response as JSON: {e}")
            print(f"📄 Full Claude response: {claude_response}")
            return {'debugInfo': f'JSON parsing error: {str(e)}. Response: {claude_response[:200]}', 'firstName': '', 'lastName': '', 'dateOfBirth': ''}
            
    except Exception as e:
        print(f"Error calling Bedrock with Claude PDF support: {str(e)}")
        return {'debugInfo': f'Bedrock Claude PDF support error: {str(e)}', 'firstName': '', 'lastName': '', 'dateOfBirth': ''}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda function to process PDF documents.
    Receives PDF content via POST request and responds with success or error.
    """
    
    try:
        # Parse the event
        http_method = event.get('httpMethod', '')
        headers = event.get('headers', {})
        
        # Handle CORS preflight
        if http_method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                'body': ''
            }
        
        # Check if it's a POST request
        if http_method != 'POST':
            return {
                'statusCode': 405,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
                    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'Method not allowed. Only POST requests are supported.'
                })
            }
        
        # Parse the request body
        body = event.get('body', '')
        if not body:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
                    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'No PDF content provided in request body.'
                })
            }
        
        # Check if body is base64 encoded (API Gateway default)
        try:
            if event.get('isBase64Encoded', False):
                body = base64.b64decode(body).decode('utf-8')
        except Exception as e:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
                    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
                },
                'body': json.dumps({
                    'success': False,
                    'error': f'Failed to decode request body: {str(e)}'
                })
            }
        
        # Parse JSON body
        try:
            request_data = json.loads(body)
        except json.JSONDecodeError as e:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
                    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
                },
                'body': json.dumps({
                    'success': False,
                    'error': f'Invalid JSON in request body: {str(e)}'
                })
            }
        
        # Extract PDF content
        pdf_content = request_data.get('pdfContent', '')
        if not pdf_content:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
                    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'No PDF content found in request. Expected "pdfContent" field.'
                })
            }
        
        # Validate PDF content (basic check)
        if not isinstance(pdf_content, str):
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
                    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'PDF content must be a string.'
                })
            }
        
        print(f"📄 Received PDF content of length: {len(pdf_content)}")
        
        # Use Claude's native PDF support for extraction
        print("🚀 Using Claude's native PDF support for extraction...")
        patient_data = extract_patient_data_with_claude_pdf_support(pdf_content)
        print(f"✅ Claude PDF support extracted patient data: {patient_data}")
        
        # Validate extracted data
        if not patient_data.get('firstName') and not patient_data.get('lastName'):
            print("⚠️ No patient name data extracted")
        if not patient_data.get('dateOfBirth'):
            print("⚠️ No date of birth extracted")
        
        # Print debug info if available
        if patient_data.get('debugInfo'):
            print(f"🔍 Claude debug info: {patient_data['debugInfo']}")
        
        # Prepare processing result with extracted data
        processing_result = {
            'success': True,
            'message': 'PDF received and processed successfully',
            'contentLength': len(pdf_content),
            'timestamp': context.aws_request_id if context else 'unknown',
            'debugInfo': patient_data.get('debugInfo', 'No debug info available'),
            'patientData': patient_data
        }
        
        
        # Check if this is being called as a GraphQL query (no httpMethod in event)
        if 'httpMethod' not in event:
            # Return data directly for GraphQL queries
            return processing_result
        else:
            # Return HTTP response for direct API calls with proper CORS headers
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
                    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
                },
                'body': json.dumps(processing_result)
            }
        
    except Exception as e:
        print(f"Error processing PDF: {str(e)}")
        error_result = {
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }
        
        # Check if this is being called as a GraphQL query (no httpMethod in event)
        if 'httpMethod' not in event:
            # Return data directly for GraphQL queries
            return error_result
        else:
            # Return HTTP response for direct API calls
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
                    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
                },
                'body': json.dumps(error_result)
            }
