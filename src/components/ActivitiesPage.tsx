import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface ActivitiesPageProps {
  user: any;
}

const ActivitiesPage: React.FC<ActivitiesPageProps> = ({ user }) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: activitiesData, errors } = await client.models.ActivityLog.activityLogsByUserId({
        userId: user?.userId || ''
      }, {
        limit: 1000
      });
      
      if (errors && errors.length > 0) {
        console.error('GraphQL errors:', errors);
        setError('Failed to fetch activities. Please check console for details.');
      } else {
        // Sort activities by createdAt in descending order (newest first)
        const sortedActivities = (activitiesData || []).sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        setActivities(sortedActivities);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      setError('Failed to fetch activities. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredActivities = activities
    .filter(activity => {
      if (filter === 'all') return true;
      return activity.action === filter;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

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

  const uniqueActions = Array.from(new Set(activities.map(a => a.action)));

  return (
    <div className="activities-page">
      <div className="activities-header">
        <h2>Activity Log</h2>
        <p>Track all your document processing activities</p>
        <button onClick={fetchActivities} className="refresh-btn" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
          <button onClick={fetchActivities} className="retry-btn">
            Try Again
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading activities...</p>
        </div>
      ) : (
        <>
          {/* Filters and Controls */}
          <div className="activities-controls">
            <div className="filter-group">
              <label htmlFor="action-filter">Filter by action:</label>
              <select
                id="action-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>
                    {action.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="sort-group">
              <label htmlFor="sort-order">Sort by:</label>
              <select
                id="sort-order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                className="sort-select"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>

          {/* Activity Stats */}
          <div className="activity-stats">
            <div className="stat-card">
              <span className="stat-number">{activities.length}</span>
              <span className="stat-label">Total Activities</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">
                {activities.filter(a => a.action === 'upload_document').length}
              </span>
              <span className="stat-label">Documents Uploaded</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">
                {activities.filter(a => a.action === 'extract_data').length}
              </span>
              <span className="stat-label">Data Extractions</span>
            </div>
          </div>

          {/* Activities List */}
          <div className="activities-list">
            {filteredActivities.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h3>No activities found</h3>
                <p>
                  {filter === 'all' 
                    ? "You haven't performed any activities yet. Upload a document to get started!"
                    : `No activities found for "${filter.replace('_', ' ')}" action.`
                  }
                </p>
              </div>
            ) : (
              filteredActivities.map((activity) => (
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
                        <h5>Details:</h5>
                        <div className="details-content">
                          {activity.action === 'upload_document' && (
                            <div className="file-info">
                              <p><strong>File:</strong> {activity.details.fileName}</p>
                              <p><strong>Size:</strong> {(activity.details.fileSize / 1024).toFixed(2)} KB</p>
                              <p><strong>Type:</strong> {activity.details.fileType}</p>
                            </div>
                          )}
                          
                          {activity.action === 'extract_data' && activity.details.extractedData && (
                            <div className="extracted-info">
                              <p><strong>Patient Data:</strong></p>
                              <ul>
                                <li>First Name: {activity.details.extractedData.firstName}</li>
                                <li>Last Name: {activity.details.extractedData.lastName}</li>
                                <li>Date of Birth: {activity.details.extractedData.dateOfBirth}</li>
                              </ul>
                            </div>
                          )}

                          <details className="raw-details">
                            <summary>Raw JSON Data</summary>
                            <pre>{JSON.stringify(activity.details, null, 2)}</pre>
                          </details>
                        </div>
                      </div>
                    )}

                    <div className="activity-meta">
                      <span className="activity-id">ID: {activity.id}</span>
                      {activity.ipAddress && (
                        <span className="activity-ip">IP: {activity.ipAddress}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ActivitiesPage;
