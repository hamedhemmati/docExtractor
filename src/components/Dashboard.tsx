import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { generateClient } from 'aws-amplify/data';
import { post } from 'aws-amplify/api';
import { uploadData } from 'aws-amplify/storage';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface DashboardProps {
  user: any;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  useEffect(() => {
    console.log('🚀 Dashboard mounted, user:', user);
    console.log('🚀 User ID:', user?.userId);
    console.log('🚀 User details:', {
      signInDetails: user?.signInDetails,
      attributes: user?.attributes
    });
    
    fetchActivities();
    createUserProfile();
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching activities for user:', user?.userId);
      const { data: activitiesData, errors } = await client.models.ActivityLog.activityLogsByUserId({
        userId: user?.userId || ''
      }, {
        limit: 1000
      });
      
      console.log('📊 Activities fetch result:', { activitiesData, errors });
      
      if (errors && errors.length > 0) {
        console.error('❌ GraphQL errors:', errors);
      }
      
      // Sort activities by createdAt in descending order (newest first)
      const sortedActivities = (activitiesData || []).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setActivities(sortedActivities);
      console.log('✅ Activities set:', sortedActivities.length, 'activities');
    } catch (error) {
      console.error('❌ Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const createUserProfile = async () => {
    try {
      console.log('👤 Creating user profile for:', user?.signInDetails?.loginId);
      const userProfile = await client.models.User.create({
        email: user?.signInDetails?.loginId || '',
        firstName: user?.attributes?.given_name || '',
        lastName: user?.attributes?.family_name || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log('✅ User profile created:', userProfile);
    } catch (error) {
      console.error('❌ Error creating user profile:', error);
    }
  };

  const logActivity = async (action: string, details: any) => {
    try {
      console.log('📝 Logging activity:', { action, details, userId: user?.userId });
      
      const activityData = {
        userId: user?.userId,
        action,
        details: JSON.stringify(details), // Stringify the details object
        ipAddress: '127.0.0.1', // In production, get real IP
        userAgent: navigator.userAgent,
        createdAt: new Date().toISOString(),
      };
      
      console.log('📝 Activity data to create:', activityData);
      
      const result = await client.models.ActivityLog.create(activityData);
      console.log('✅ Activity created successfully:', result);
      
      // Refresh activities after a short delay to ensure the new activity is available
      setTimeout(() => {
        console.log('🔄 Refreshing activities after creation...');
        fetchActivities();
      }, 1000);
    } catch (error) {
      console.error('❌ Error logging activity:', error);
    }
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'upload_document':
        return '📄';
      case 'extract_data':
        return '🔍';
      case 'login':
        return '🔑';
      case 'view_dashboard':
        return '📊';
      default:
        return '📝';
    }
  };

  const getActivityColor = (action: string) => {
    switch (action) {
      case 'upload_document':
        return '#007bff';
      case 'extract_data':
        return '#28a745';
      case 'login':
        return '#6f42c1';
      case 'view_dashboard':
        return '#17a2b8';
      default:
        return '#6c757d';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      full: date.toLocaleString()
    };
  };

  const processPDFWithFunction = async (file: File) => {
    try {
      console.log('🔄 Processing PDF with S3 approach...');
      console.log('📄 File details:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
      
      // Upload PDF to S3 first
      console.log('📤 Uploading PDF to S3...');
      const uploadResult = await uploadData({
        path: `pdfs/${file.name}`,
        data: file,
        options: {
          contentType: 'application/pdf'
        }
      }).result;
      
      console.log('✅ PDF uploaded to S3:', uploadResult);
      
      // Convert file to base64 for the API call (keeping the same API structure)
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          console.log('📄 FileReader result type:', typeof result);
          console.log('📄 FileReader result length:', result.length);
          console.log('📄 FileReader result preview:', result.substring(0, 100));
          
          // Remove data URL prefix to get just the base64 content
          const base64 = result.split(',')[1];
          console.log('📄 Extracted base64 length:', base64.length);
          console.log('📄 Extracted base64 preview:', base64.substring(0, 50));
          
          if (!base64) {
            reject(new Error('Failed to extract base64 content from file'));
            return;
          }
          
          resolve(base64);
        };
        reader.onerror = (error) => {
          console.error('❌ FileReader error:', error);
          reject(error);
        };
        reader.readAsDataURL(file);
      });

      console.log('📤 Sending PDF to processor function...');
      console.log('📤 API Name: pdf-processor-api');
      console.log('📤 Path: process-pdf');
      console.log('📤 Base64 content length:', base64Content.length);
      console.log('📤 Base64 content size in MB:', (base64Content.length * 0.75 / 1024 / 1024).toFixed(2));
      
      // Call the PDF processor REST API
      const restOperation = post({
        apiName: 'pdf-processor-api',
        path: 'process-pdf',
        options: {
          body: {
            pdfContent: base64Content
          }
        }
      });

      const { body } = await restOperation.response;
      const result = await body.json() as {
        success: boolean;
        message: string;
        contentLength: number;
        timestamp: string;
        error?: string;
        extractedText?: string;
        debugInfo?: string;
        patientData?: {
          firstName: string;
          lastName: string;
          dateOfBirth: string;
          debugInfo?: string;
        };
      };

      console.log('📥 PDF processor response:', result);
      console.log('📥 Response debug info:', result.debugInfo);
      console.log('📥 Patient data debug info:', result.patientData?.debugInfo);

      if (result && result.success === true) {
        // Use actual extracted data from the PDF processor
        const extractedData = {
          firstName: result.patientData?.firstName || 'Not found',
          lastName: result.patientData?.lastName || 'Not found', 
          dateOfBirth: result.patientData?.dateOfBirth || 'Not found',
          extractedAt: new Date().toISOString(),
          processingId: result.timestamp,
          contentLength: result.contentLength,
          debugInfo: result.debugInfo || result.patientData?.debugInfo || 'No debug info available',
          extractedText: result.extractedText // For debugging
        };

        console.log('📊 Setting extracted data:', extractedData);
        setExtractedData(extractedData);
        
        // Log extraction activity
        console.log('📝 Starting extraction activity logging...');
        await logActivity('extract_data', {
          fileName: file.name,
          extractedData: extractedData,
          processingTime: '2.5s',
          functionResponse: result
        });

        console.log('✅ Document processing completed');
        return true;
      } else {
        throw new Error(result?.error || 'PDF processing failed');
      }
    } catch (error: any) {
      console.error('❌ Error processing PDF with function:', error);
      if (error.response) {
        const errorBody = await error.response.body.json();
        console.error('❌ Error response body:', errorBody);
        throw new Error(`PDF processing failed: ${errorBody.message || 'Unknown error'}`);
      }
      throw error;
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) {
      console.log('❌ No file provided');
      return;
    }

    console.log('📁 File dropped:', { name: file.name, size: file.size, type: file.type });
    setUploading(true);
    
    try {
      // Log upload activity
      console.log('📝 Starting upload activity logging...');
      await logActivity('upload_document', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadTime: new Date().toISOString(),
      });

      // Process PDF with the function
      console.log('⏳ Starting PDF processing with function...');
      await processPDFWithFunction(file);

      console.log('✅ Document processing completed');
      setUploading(false);
    } catch (error) {
      console.error('❌ Error processing file:', error);
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    disabled: uploading
  });

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Document Extractor</h2>
        <p>Upload PDF documents to extract patient information</p>
      </div>
      
      <div className="dashboard-content">
        {/* File Upload Section */}
        <div className="upload-section">
          <div 
            {...getRootProps()} 
            className={`dropzone ${isDragActive ? 'active' : ''} ${uploading ? 'uploading' : ''}`}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="upload-status">
                <div className="spinner"></div>
                <p>Processing document...</p>
              </div>
            ) : (
              <div className="upload-content">
                <div className="upload-icon">📄</div>
                <p className="upload-text">
                  {isDragActive 
                    ? 'Drop the PDF file here...' 
                    : 'Drag & drop a PDF file here, or click to select'
                  }
                </p>
                <p className="upload-hint">Only PDF files are accepted</p>
              </div>
            )}
          </div>
        </div>

        {/* Extracted Data Display */}
        {extractedData && (
          <div className="extracted-data-section">
            <h3>Extracted Patient Data</h3>
            <div className="extracted-data-card">
              <div className="data-field">
                <label>First Name:</label>
                <span>{extractedData.firstName}</span>
              </div>
              <div className="data-field">
                <label>Last Name:</label>
                <span>{extractedData.lastName}</span>
              </div>
              <div className="data-field">
                <label>Date of Birth:</label>
                <span>{extractedData.dateOfBirth}</span>
              </div>
              <div className="data-field">
                <label>Extracted At:</label>
                <span>{new Date(extractedData.extractedAt).toLocaleString()}</span>
              </div>
              {extractedData.debugInfo && (
                <div className="data-field">
                  <label>Debug Info:</label>
                  <span style={{ fontSize: '0.9em', color: '#666' }}>{extractedData.debugInfo}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity Log Section */}
        <div className="activities-section">
          <h3>Recent Activity</h3>
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading activities...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <h4>No activities yet</h4>
              <p>Upload a document to get started!</p>
            </div>
          ) : (
            <div className="activities-list">
              {activities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-icon" style={{ color: getActivityColor(activity.action) }}>
                    {getActivityIcon(activity.action)}
                  </div>
                  
                  <div className="activity-content">
                    <div className="activity-header">
                      <h4 className="activity-title">
                        {activity.action.replace('_', ' ').toUpperCase()}
                      </h4>
                      <div className="activity-time">
                        <span className="time-date">{formatDate(activity.createdAt).date}</span>
                        <span className="time-time">{formatDate(activity.createdAt).time}</span>
                      </div>
                    </div>

                    {activity.details && (
                      <div className="activity-details">
                        {(() => {
                          try {
                            const parsedDetails = typeof activity.details === 'string' 
                              ? JSON.parse(activity.details) 
                              : activity.details;
                            
                            return (
                              <>
                                {activity.action === 'upload_document' && (
                                  <div className="file-info">
                                    <p><strong>File:</strong> {parsedDetails.fileName}</p>
                                    <p><strong>Size:</strong> {(parsedDetails.fileSize / 1024).toFixed(2)} KB</p>
                                  </div>
                                )}
                                
                                {activity.action === 'extract_data' && parsedDetails.extractedData && (
                                  <div className="extracted-info">
                                    <p><strong>Patient Data:</strong></p>
                                    <ul>
                                      <li>First Name: {parsedDetails.extractedData.firstName}</li>
                                      <li>Last Name: {parsedDetails.extractedData.lastName}</li>
                                      <li>Date of Birth: {parsedDetails.extractedData.dateOfBirth}</li>
                                    </ul>
                                  </div>
                                )}
                              </>
                            );
                          } catch (error) {
                            console.error('Error parsing activity details:', error);
                            return <p>Error parsing details</p>;
                          }
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
