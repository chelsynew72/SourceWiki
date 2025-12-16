import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAuth } from '../lib/auth-context';
import { adminApi } from '../lib/api';
import { toast } from 'sonner';
import {
  Download,
  FileText,
  Filter,
  Trash2,
  CheckCircle,
  XCircle,
  Settings,
  Eye,
  Database,
  CheckSquare,
  Square,
  AlertTriangle,
  FileSpreadsheet,
  Eye as PreviewIcon,
  Play,
  Loader2
} from 'lucide-react';

interface Submission {
  id: string;
  url: string;
  title: string;
  publisher: string;
  country: string;
  category: string;
  status: string;
  submitter?: any;
  verifier?: any;
  wikipediaArticle?: string;
  verifierNotes?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ExportFilters {
  format: 'csv' | 'json';
  status?: string;
  category?: string;
  country?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  submitter?: string;
  limit: number;
  offset: number;
}

interface BatchOperationData {
  action: 'approve' | 'reject' | 'delete' | 'update';
  submissionIds?: string[];
  filters?: {
    status?: string;
    category?: string;
    country?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  updateData?: {
    credibility?: 'credible' | 'unreliable';
    verifierNotes?: string;
    category?: string;
    wikipediaArticle?: string;
  };
  batchNotes?: string;
}

export const AdminExportBatch: React.FC = () => {
  const { user } = useAuth();
  
  // Export state
  const [exportFilters, setExportFilters] = useState<ExportFilters>({
    format: 'json',
    limit: 1000,
    offset: 0
  });
  const [exportPreview, setExportPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  
  // Batch operation state
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([]);
  const [batchFilters, setBatchFilters] = useState<any>({});
  const [batchOperation, setBatchOperation] = useState<BatchOperationData | null>(null);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchResults, setBatchResults] = useState<any>(null);
  const [loadingBatch, setLoadingBatch] = useState(false);
  
  // Common state
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);


  const handleExportPreview = async () => {
    setLoadingPreview(true);
    try {
      const filters: any = {
        limit: 100
      };
      
      // Only include non-"all" filters
      if (exportFilters.status && exportFilters.status !== 'all') filters.status = exportFilters.status;
      if (exportFilters.category && exportFilters.category !== 'all') filters.category = exportFilters.category;
      if (exportFilters.country) filters.country = exportFilters.country;
      if (exportFilters.dateFrom) filters.dateFrom = exportFilters.dateFrom;
      if (exportFilters.dateTo) filters.dateTo = exportFilters.dateTo;
      if (exportFilters.search) filters.search = exportFilters.search;
      if (exportFilters.submitter) filters.submitter = exportFilters.submitter;

      const response = await adminApi.getExportPreview(filters);
      
      if (response.success) {
        setExportPreview(response);
        toast.success(`Found ${response.totalMatchingRecords} matching records`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to get export preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExport = async () => {
    setLoadingExport(true);
    try {
      const response = await adminApi.exportSubmissions(exportFilters);
      
      if (exportFilters.format === 'csv') {
        // Handle CSV download
        const blob = new Blob([response], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `submissions_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // Handle JSON download
        const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `submissions_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
      
      toast.success(`Export completed successfully`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to export data');
    } finally {
      setLoadingExport(false);
    }
  };

  const handleBatchOperation = async () => {
    if (!batchOperation) return;
    
    setLoadingBatch(true);
    try {
      const response = await adminApi.batchUpdateSubmissions(batchOperation);
      
      if (response.success) {
        setBatchResults(response.results);
        toast.success(`Batch operation completed: ${response.results.summary.successful} successful, ${response.results.summary.failed} failed`);
        setShowBatchDialog(false);
        setSelectedSubmissions([]);
        setBatchOperation(null);
      }
    } catch (error: any) {
      toast.error(error.message || 'Batch operation failed');
    } finally {
      setLoadingBatch(false);
    }
  };

  const openBatchDialog = (action: BatchOperationData['action']) => {
    if (action === 'update') {
      setBatchOperation({
        action,
        submissionIds: selectedSubmissions.length > 0 ? selectedSubmissions : undefined,
        filters: Object.keys(batchFilters).length > 0 ? batchFilters : undefined,
        updateData: {}
      });
    } else {
      setBatchOperation({
        action,
        submissionIds: selectedSubmissions.length > 0 ? selectedSubmissions : undefined,
        filters: Object.keys(batchFilters).length > 0 ? batchFilters : undefined,
        batchNotes: ''
      });
    }
    setShowBatchDialog(true);
  };

  const toggleSubmissionSelection = (id: string) => {
    setSelectedSubmissions(prev => 
      prev.includes(id) 
        ? prev.filter(submissionId => submissionId !== id)
        : [...prev, id]
    );
  };

  const selectAllSubmissions = () => {
    if (selectedSubmissions.length === submissions.length) {
      setSelectedSubmissions([]);
    } else {
      setSelectedSubmissions(submissions.map(s => s.id));
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Admin privileges required for export and batch operations
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="mb-2">Export & Batch Operations</h1>
        <p className="text-gray-600">
          Export submission data and perform batch operations on multiple submissions
        </p>
      </div>

      <Tabs defaultValue="export" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="export">Data Export</TabsTrigger>
          <TabsTrigger value="batch">Batch Operations</TabsTrigger>
        </TabsList>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Configuration
              </CardTitle>
              <CardDescription>
                Configure filters and export submission data in CSV or JSON format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Export Format */}
              <div className="space-y-2">
                <Label>Export Format</Label>
                <Select 
                  value={exportFilters.format} 
                  onValueChange={(value: 'csv' | 'json') => 
                    setExportFilters(prev => ({ ...prev, format: value }))
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON Format</SelectItem>
                    <SelectItem value="csv">CSV Format</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 

                  value={exportFilters.status || 'all'}
                    onValueChange={(value) => 
                      setExportFilters(prev => ({ 
                        ...prev, 
                        status: value || undefined 
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>

                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select 

                  value={exportFilters.category || 'all'}
                    onValueChange={(value) => 
                      setExportFilters(prev => ({ 
                        ...prev, 
                        category: value || undefined 
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>

                    <SelectItem value="all">All categories</SelectItem>
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="secondary">Secondary</SelectItem>
                    <SelectItem value="unreliable">Unreliable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input 
                    placeholder="Country name"
                    value={exportFilters.country || ''}
                    onChange={(e) => 
                      setExportFilters(prev => ({ 
                        ...prev, 
                        country: e.target.value || undefined 
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date From</Label>
                  <Input 
                    type="date"
                    value={exportFilters.dateFrom || ''}
                    onChange={(e) => 
                      setExportFilters(prev => ({ 
                        ...prev, 
                        dateFrom: e.target.value || undefined 
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date To</Label>
                  <Input 
                    type="date"
                    value={exportFilters.dateTo || ''}
                    onChange={(e) => 
                      setExportFilters(prev => ({ 
                        ...prev, 
                        dateTo: e.target.value || undefined 
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Search</Label>
                  <Input 
                    placeholder="Search in title, publisher, URL"
                    value={exportFilters.search || ''}
                    onChange={(e) => 
                      setExportFilters(prev => ({ 
                        ...prev, 
                        search: e.target.value || undefined 
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Limit</Label>
                  <Input 
                    type="number"
                    min="1"
                    max="10000"
                    value={exportFilters.limit}
                    onChange={(e) => 
                      setExportFilters(prev => ({ 
                        ...prev, 
                        limit: parseInt(e.target.value) || 1000 
                      }))
                    }
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  onClick={handleExportPreview}
                  disabled={loadingPreview}
                >
                  {loadingPreview ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PreviewIcon className="h-4 w-4 mr-2" />
                  )}
                  Preview Export
                </Button>
                <Button 
                  onClick={handleExport}
                  disabled={loadingExport}
                >
                  {loadingExport ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Export Data
                </Button>
              </div>

              {/* Preview Results */}
              {exportPreview && (
                <Card className="bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-sm">Export Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div><strong>Total Matching Records:</strong> {exportPreview.totalMatchingRecords}</div>
                      <div><strong>Preview Records:</strong> {exportPreview.previewRecords}</div>
                      <div className="mt-4">
                        <strong>Sample Data:</strong>
                        <div className="mt-2 space-y-2">
                          {exportPreview.previewData?.slice(0, 3).map((item: any, index: number) => (
                            <div key={index} className="p-2 bg-white rounded border">
                              <div><strong>{item.title}</strong></div>
                              <div className="text-gray-600">{item.publisher}</div>
                              <div className="text-xs text-gray-500">
                                {item.country} • {item.category} • {item.status}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batch Operations Tab */}
        <TabsContent value="batch" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Batch Operations
              </CardTitle>
              <CardDescription>
                Perform bulk operations on multiple submissions simultaneously
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selection Mode */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Selection Method</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 border-2 border-dashed border-gray-200">
                    <div className="text-center">
                      <CheckSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <h4 className="font-medium mb-2">Select Specific Submissions</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Choose individual submissions from the list below
                      </p>
                      <div className="text-xs text-gray-500">
                        Selected: {selectedSubmissions.length}
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-4 border-2 border-dashed border-gray-200">
                    <div className="text-center">
                      <Filter className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <h4 className="font-medium mb-2">Filter-Based Selection</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Use filters to select multiple submissions at once
                      </p>
                      <div className="text-xs text-gray-500">
                        Filters: {Object.keys(batchFilters).length}
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Batch Filters */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Batch Filters (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select 

                      value={batchFilters.status || 'all'}
                      onValueChange={(value) => 
                        setBatchFilters(prev => ({ 
                          ...prev, 
                          status: value || undefined 
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>

                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select 

                      value={batchFilters.category || 'all'}
                      onValueChange={(value) => 
                        setBatchFilters(prev => ({ 
                          ...prev, 
                          category: value || undefined 
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>

                        <SelectItem value="all">All categories</SelectItem>
                        <SelectItem value="primary">Primary</SelectItem>
                        <SelectItem value="secondary">Secondary</SelectItem>
                        <SelectItem value="unreliable">Unreliable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input 
                      placeholder="Country name"
                      value={batchFilters.country || ''}
                      onChange={(e) => 
                        setBatchFilters(prev => ({ 
                          ...prev, 
                          country: e.target.value || undefined 
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Date From</Label>
                    <Input 
                      type="date"
                      value={batchFilters.dateFrom || ''}
                      onChange={(e) => 
                        setBatchFilters(prev => ({ 
                          ...prev, 
                          dateFrom: e.target.value || undefined 
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Date To</Label>
                    <Input 
                      type="date"
                      value={batchFilters.dateTo || ''}
                      onChange={(e) => 
                        setBatchFilters(prev => ({ 
                          ...prev, 
                          dateTo: e.target.value || undefined 
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Batch Actions */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Batch Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button 
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => openBatchDialog('approve')}
                    disabled={selectedSubmissions.length === 0 && Object.keys(batchFilters).length === 0}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  
                  <Button 
                    variant="destructive"
                    onClick={() => openBatchDialog('reject')}
                    disabled={selectedSubmissions.length === 0 && Object.keys(batchFilters).length === 0}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={() => openBatchDialog('update')}
                    disabled={selectedSubmissions.length === 0 && Object.keys(batchFilters).length === 0}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Update
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => openBatchDialog('delete')}
                    disabled={selectedSubmissions.length === 0 && Object.keys(batchFilters).length === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>

              {/* Batch Results */}
              {batchResults && (
                <Card className="bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-sm">Last Batch Operation Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div><strong>Total Processed:</strong> {batchResults.summary.totalProcessed}</div>
                      <div><strong>Successful:</strong> {batchResults.summary.successful}</div>
                      <div><strong>Failed:</strong> {batchResults.summary.failed}</div>
                      <div><strong>Success Rate:</strong> {batchResults.summary.successRate}</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Batch Operation Dialog */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Batch Operation</DialogTitle>
            <DialogDescription>
              Please confirm the batch operation details before proceeding
            </DialogDescription>
          </DialogHeader>

          {batchOperation && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Operation: {batchOperation.action.toUpperCase()}</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div><strong>Selected Submissions:</strong> {batchOperation.submissionIds?.length || 'Using filters'}</div>
                  <div><strong>Using Filters:</strong> {batchOperation.filters ? 'Yes' : 'No'}</div>
                </div>
              </div>

              {batchOperation.action === 'approve' && (
                <div className="space-y-2">
                  <Label>Credibility Rating *</Label>
                  <Select 

                    value={batchOperation.updateData?.credibility || 'placeholder'}
                    onValueChange={(value: 'credible' | 'unreliable') => 
                      setBatchOperation(prev => ({
                        ...prev!,
                        updateData: { ...prev?.updateData, credibility: value }
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select credibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credible">Credible</SelectItem>
                      <SelectItem value="unreliable">Unreliable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(batchOperation.action === 'update') && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>New Category</Label>
                    <Select 

                      value={batchOperation.updateData?.category || 'placeholder'}
                      onValueChange={(value) => 
                        setBatchOperation(prev => ({
                          ...prev!,
                          updateData: { ...prev?.updateData, category: value }
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">Primary</SelectItem>
                        <SelectItem value="secondary">Secondary</SelectItem>
                        <SelectItem value="unreliable">Unreliable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Wikipedia Article</Label>
                    <Input 
                      placeholder="Wikipedia article URL"
                      value={batchOperation.updateData?.wikipediaArticle || ''}
                      onChange={(e) => 
                        setBatchOperation(prev => ({
                          ...prev!,
                          updateData: { ...prev?.updateData, wikipediaArticle: e.target.value }
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Batch Notes (Optional)</Label>
                <Textarea 
                  placeholder="Add notes about this batch operation..."
                  value={batchOperation.batchNotes || ''}
                  onChange={(e) => 
                    setBatchOperation(prev => ({ ...prev!, batchNotes: e.target.value }))
                  }
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowBatchDialog(false)}
              disabled={loadingBatch}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleBatchOperation}
              disabled={loadingBatch || 
                (batchOperation?.action === 'approve' && !batchOperation.updateData?.credibility)
              }
            >
              {loadingBatch ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Execute Batch Operation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
