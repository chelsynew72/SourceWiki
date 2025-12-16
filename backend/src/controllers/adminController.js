import User from '../models/User.js';
import Submission from '../models/Submission.js';
import CountryStats from '../models/CountryStats.js';
import AppError from '../utils/AppError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

class AdminController {
  // ============================================================================
  // DASHBOARD & ANALYTICS
  // ============================================================================


  static async getDashboard(req, res, next) {
    try {
      // Global statistics
      const [
        totalUsers,
        totalSubmissions,
        usersByRole,
        submissionsByStatus,
        submissionsByCountry,
        recentSubmissions,
        topCountries
      ] = await Promise.all([
        User.countDocuments(),
        Submission.countDocuments(),
        User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
        Submission.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Submission.aggregate([
          { $group: { _id: '$country', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        Submission.find()
          .populate('submitter', 'username country')
          .populate('verifier', 'username country')
          .sort({ createdAt: -1 })
          .limit(50),
        CountryStats.find()
          .sort({ 'statistics.verifiedSources': -1 })
          .limit(10)
      ]);

      const dashboard = {
        globalStats: {
          totalUsers,
          totalSubmissions,
          usersByRole: usersByRole.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
          submissionsByStatus: submissionsByStatus.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        },
        charts: {
          submissionsByCountry,
          topCountries: topCountries.map(country => ({
            country: country.countryName,
            code: country.countryCode,
            verified: country.statistics.verifiedSources,
            total: country.statistics.totalSubmissions
          }))
        },
        recentActivity: recentSubmissions
      };

      res.json(dashboard);
    } catch (error) {
      next(error);
    }
  }

  static async getAnalytics(req, res, next) {
    try {
      const period = req.query.period || '30d';
      const country = req.query.country;
      
      // Calculate date range
      const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[period];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Build match filters
      const matchFilter = { createdAt: { $gte: startDate } };
      if (country) matchFilter.country = country;
      
      const [submissionTrends, verificationSpeed] = await Promise.all([
        // Time series data for submissions
        Submission.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: {
                date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                status: '$status'
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.date': 1 } }
        ]),
        
        // Verification speed analytics
        Submission.aggregate([
          {
            $match: {
              ...matchFilter,
              status: { $in: ['approved', 'rejected'] },
              verifiedAt: { $exists: true }
            }
          },
          {
            $project: {
              daysToVerify: {
                $divide: [
                  { $subtract: ['$verifiedAt', '$createdAt'] },
                  1000 * 60 * 60 * 24
                ]
              },
              country: 1,
              status: 1
            }
          },
          {
            $group: {
              _id: '$country',
              avgDays: { $avg: '$daysToVerify' },
              minDays: { $min: '$daysToVerify' },
              maxDays: { $max: '$daysToVerify' },
              totalReviewed: { $sum: 1 }
            }
          }
        ])
      ]);
      
      res.json({
        period,
        country,
        trends: submissionTrends,
        verificationSpeed,
        generated: new Date()
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  static async getUsers(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      
      // Build filter
      const filter = {};
      if (req.query.role) filter.role = req.query.role;
      if (req.query.country) filter.country = req.query.country;
      if (req.query.status) filter.isActive = req.query.status === 'active';
      if (req.query.search) {
        filter.$or = [
          { username: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } }
        ];
      }
      
      const [users, total] = await Promise.all([
        User.find(filter)
          .select('-password')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        User.countDocuments(filter)
      ]);
      
      // Get submission stats for each user
      const userIds = users.map(user => user._id);
      const submissionStats = await Submission.aggregate([
        { $match: { submitter: { $in: userIds } } },
        {
          $group: {
            _id: '$submitter',
            total: { $sum: 1 },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
          }
        }
      ]);
      
      // Merge stats with users
      const usersWithStats = users.map(user => {
        const stats = submissionStats.find(stat => stat._id.toString() === user._id.toString());
        return {
          ...user.toObject(),
          submissionStats: stats || { total: 0, approved: 0, pending: 0, rejected: 0 }
        };
      });
      
      res.json({
        users: usersWithStats,
        pagination: { 
          current: page, 
          pages: Math.ceil(total / limit), 
          total, 
          limit 
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateUser(req, res, next) {
    try {
      const userId = req.params.id;
      
      // Prevent self-modification
      if (userId === req.user._id.toString()) {
        return next(new AppError('Cannot modify your own account', 400, ErrorCodes.INVALID_INPUT));
      }
      
      // Build updates object
      const updates = {};
      if (req.body.role !== undefined) updates.role = req.body.role;
      if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
      if (req.body.country !== undefined) updates.country = req.body.country;
      if (req.body.points !== undefined) updates.points = req.body.points;
      if (req.body.badges !== undefined) updates.badges = req.body.badges;
      
      const user = await User.findByIdAndUpdate(
        userId, 
        updates, 
        { new: true, runValidators: true }
      ).select('-password');
      
      if (!user) {
        return next(new AppError('User not found', 404, ErrorCodes.RESOURCE_NOT_FOUND));
      }
      
      // If role changed to verifier, update CountryStats
      if (updates.role === 'verifier') {
        const countryStats = await CountryStats.getOrCreate(user.country, '');
        if (!countryStats.verifiers.find(v => v.userId.toString() === userId)) {
          countryStats.verifiers.push({ userId: user._id });
          await countryStats.save();
        }
      }
      
      res.json({ 
        message: 'User updated successfully', 
        user 
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteUser(req, res, next) {
    try {
      const userId = req.params.id;
      
      if (userId === req.user._id.toString()) {
        return next(new AppError('Cannot delete your own account', 400, ErrorCodes.INVALID_INPUT));
      }
      
      const user = await User.findById(userId);
      if (!user) {
        return next(new AppError('User not found', 404, ErrorCodes.RESOURCE_NOT_FOUND));
      }

      // Soft delete
      const deletedUser = await User.findByIdAndUpdate(
        userId,
        { 
          isActive: false, 
          email: `deleted_${Date.now()}_${user.email}` 
        },
        { new: true }
      ).select('-password');
      
      res.json({ 
        message: 'User deleted successfully', 
        user: deletedUser 
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================================================
  // SUBMISSION MANAGEMENT
  // ============================================================================

  static async getSubmissions(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      
      // Build filter
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      if (req.query.category) filter.category = req.query.category;
      if (req.query.country) filter.country = req.query.country;
      if (req.query.search) {
        filter.$or = [
          { title: { $regex: req.query.search, $options: 'i' } },
          { publisher: { $regex: req.query.search, $options: 'i' } },
          { url: { $regex: req.query.search, $options: 'i' } }
        ];
      }
      
      const [submissions, total] = await Promise.all([
        Submission.find(filter)
          .populate('submitter', 'username email country')
          .populate('verifier', 'username email country')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Submission.countDocuments(filter)
      ]);
      
      res.json({
        submissions,
        pagination: { 
          current: page, 
          pages: Math.ceil(total / limit), 
          total, 
          limit 
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async overrideSubmission(req, res, next) {
    try {
      const submissionId = req.params.id;
      const { status, adminNotes, reason } = req.body;
      
      const submission = await Submission.findById(submissionId);
      if (!submission) {
        return next(new AppError('Submission not found', 404, ErrorCodes.RESOURCE_NOT_FOUND));
      }
      
      // Store original values for audit
      const originalStatus = submission.status;
      const originalVerifier = submission.verifier;
      
      // Update submission
      submission.status = status;
      submission.verifier = req.user._id;
      submission.verifiedAt = new Date();
      submission.verifierNotes = adminNotes;
      
      await submission.save();
      
      res.json({ 
        message: 'Submission override successful', 
        submission 
      });
    } catch (error) {
      next(error);
    }
  }


  static async deleteSubmission(req, res, next) {
    try {
      const submissionId = req.params.id;
      const { reason } = req.body;
      
      const submission = await Submission.findById(submissionId);
      if (!submission) {
        return next(new AppError('Submission not found', 404, ErrorCodes.RESOURCE_NOT_FOUND));
      }
      
      await Submission.findByIdAndDelete(submissionId);
      
      res.json({ message: 'Submission deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ============================================================================
  // EXPORT FUNCTIONALITY
  // ============================================================================

  static async exportSubmissions(req, res, next) {
    try {
      const { 
        format = 'json', 
        status, 
        category, 
        country, 
        dateFrom, 
        dateTo, 
        search, 
        submitter,
        limit = 1000,
        offset = 0 
      } = req.query;

      // Build filter query
      const filter = {};
      
      if (status) filter.status = status;
      if (category) filter.category = category;
      if (country) filter.country = country;
      if (submitter) filter.submitter = submitter;
      
      // Date range filtering
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
      }
      
      // Search filtering
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { publisher: { $regex: search, $options: 'i' } },
          { url: { $regex: search, $options: 'i' } }
        ];
      }

      // Fetch submissions with populated fields
      const submissions = await Submission.find(filter)
        .populate('submitter', 'username email country')
        .populate('verifier', 'username email country')
        .sort({ createdAt: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit));

      // Prepare data for export
      const exportData = submissions.map(submission => ({
        id: submission._id,
        url: submission.url,
        title: submission.title,
        publisher: submission.publisher,
        country: submission.country,
        category: submission.category,
        status: submission.status,
        credibility: submission.credibility || '',
        submittedDate: submission.submittedDate,
        verifiedAt: submission.verifiedAt || '',
        submitter: submission.submitter?.username || '',
        submitterEmail: submission.submitter?.email || '',
        submitterCountry: submission.submitter?.country || '',
        verifier: submission.verifier?.username || '',
        verifierEmail: submission.verifier?.email || '',
        wikipediaArticle: submission.wikipediaArticle || '',
        verifierNotes: submission.verifierNotes || '',
        fileType: submission.fileType,
        fileName: submission.fileName || '',
        tags: submission.tags?.join(', ') || '',
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt
      }));

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `submissions_export_${timestamp}`;

      if (format.toLowerCase() === 'csv') {
        // Generate CSV manually
        const csvHeader = 'ID,URL,Title,Publisher,Country,Category,Status,Credibility,Submitted Date,Verified Date,Submitter,Submitter Email,Submitter Country,Verifier,Verifier Email,Wikipedia Article,Verifier Notes,File Type,File Name,Tags,Created At,Updated At';
        
        const csvRows = exportData.map(row => {
          const values = [
            row.id,
            `"${(row.url || '').replace(/"/g, '""')}"`,
            `"${(row.title || '').replace(/"/g, '""')}"`,
            `"${(row.publisher || '').replace(/"/g, '""')}"`,
            row.country,
            row.category,
            row.status,
            row.credibility,
            row.submittedDate ? new Date(row.submittedDate).toISOString().split('T')[0] : '',
            row.verifiedAt ? new Date(row.verifiedAt).toISOString().split('T')[0] : '',
            `"${(row.submitter || '').replace(/"/g, '""')}"`,
            `"${(row.submitterEmail || '').replace(/"/g, '""')}"`,
            row.submitterCountry,
            `"${(row.verifier || '').replace(/"/g, '""')}"`,
            `"${(row.verifierEmail || '').replace(/"/g, '""')}"`,
            `"${(row.wikipediaArticle || '').replace(/"/g, '""')}"`,
            `"${(row.verifierNotes || '').replace(/"/g, '""')}"`,
            row.fileType,
            `"${(row.fileName || '').replace(/"/g, '""')}"`,
            `"${(row.tags || '').replace(/"/g, '""')}"`,
            row.createdAt.toISOString(),
            row.updatedAt.toISOString()
          ];
          return values.join(',');
        });

        const csvContent = [csvHeader, ...csvRows].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.send(csvContent);
      } else {
        // Return JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        res.json({
          success: true,
          exportDate: new Date().toISOString(),
          totalRecords: exportData.length,
          filters: {
            status,
            category,
            country,
            dateFrom,
            dateTo,
            search,
            submitter
          },
          data: exportData
        });
      }
    } catch (error) {
      next(error);
    }
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  static async batchUpdateSubmissions(req, res, next) {
    try {
      const { 
        action, 
        submissionIds, 
        filters, 
        updateData,
        batchNotes 
      } = req.body;

      // Validate inputs
      if (!action || (!submissionIds?.length && !filters)) {
        return next(new AppError('Either submissionIds array or filters object is required', 400, ErrorCodes.INVALID_INPUT));
      }

      if (!['approve', 'reject', 'delete', 'update'].includes(action)) {
        return next(new AppError('Invalid action. Must be approve, reject, delete, or update', 400, ErrorCodes.INVALID_INPUT));
      }

      // Build filter query for batch operation
      let filter = {};
      if (submissionIds?.length) {
        filter._id = { $in: submissionIds };
      }
      if (filters) {
        if (filters.status) filter.status = filters.status;
        if (filters.category) filter.category = filters.category;
        if (filters.country) filter.country = filters.country;
        if (filters.dateFrom || filters.dateTo) {
          filter.createdAt = {};
          if (filters.dateFrom) filter.createdAt.$gte = new Date(filters.dateFrom);
          if (filters.dateTo) filter.createdAt.$lte = new Date(filters.dateTo);
        }
      }

      // Get submissions that match the filter
      const submissions = await Submission.find(filter);
      
      if (submissions.length === 0) {
        return next(new AppError('No submissions found matching the criteria', 404, ErrorCodes.RESOURCE_NOT_FOUND));
      }

      const results = {
        totalProcessed: submissions.length,
        successful: [],
        failed: [],
        summary: {}
      };

      // Process batch operation
      switch (action) {
        case 'approve':
          if (!updateData?.credibility) {
            return next(new AppError('Credibility rating is required for approval', 400, ErrorCodes.INVALID_INPUT));
          }

          for (const submission of submissions) {
            try {
              if (submission.status !== 'pending') {
                results.failed.push({
                  id: submission._id,
                  reason: 'Submission is not in pending status'
                });
                continue;
              }

              submission.status = 'approved';
              submission.credibility = updateData.credibility;
              submission.verifier = req.user._id;
              submission.verifierNotes = batchNotes || updateData.verifierNotes;
              submission.verifiedAt = new Date();

              await submission.save();

              // Award points to submitter
              const points = updateData.credibility === 'credible' ? 25 : 10;
              await User.findByIdAndUpdate(submission.submitter, {
                $inc: { points: points }
              });

              // Award points to verifier
              await User.findByIdAndUpdate(req.user._id, {
                $inc: { points: 5 }
              });

              results.successful.push({
                id: submission._id,
                action: 'approved',
                credibility: updateData.credibility
              });
            } catch (error) {
              results.failed.push({
                id: submission._id,
                reason: error.message
              });
            }
          }
          break;

        case 'reject':
          for (const submission of submissions) {
            try {
              if (submission.status !== 'pending') {
                results.failed.push({
                  id: submission._id,
                  reason: 'Submission is not in pending status'
                });
                continue;
              }

              submission.status = 'rejected';
              submission.verifier = req.user._id;
              submission.verifierNotes = batchNotes || updateData?.verifierNotes;
              submission.verifiedAt = new Date();

              await submission.save();

              // Award points to verifier
              await User.findByIdAndUpdate(req.user._id, {
                $inc: { points: 5 }
              });

              results.successful.push({
                id: submission._id,
                action: 'rejected'
              });
            } catch (error) {
              results.failed.push({
                id: submission._id,
                reason: error.message
              });
            }
          }
          break;

        case 'delete':
          for (const submission of submissions) {
            try {
              await Submission.findByIdAndDelete(submission._id);
              results.successful.push({
                id: submission._id,
                action: 'deleted'
              });
            } catch (error) {
              results.failed.push({
                id: submission._id,
                reason: error.message
              });
            }
          }
          break;

        case 'update':
          if (!updateData) {
            return next(new AppError('Update data is required for update action', 400, ErrorCodes.INVALID_INPUT));
          }

          const allowedFields = ['category', 'wikipediaArticle', 'verifierNotes'];
          const updates = {};
          
          for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
              updates[field] = updateData[field];
            }
          }

          if (Object.keys(updates).length === 0) {
            return next(new AppError('No valid fields to update', 400, ErrorCodes.INVALID_INPUT));
          }

          const updateResult = await Submission.updateMany(filter, {
            ...updates,
            updatedAt: new Date()
          });

          results.successful.push({
            id: 'bulk_update',
            action: 'updated',
            matched: updateResult.matchedCount,
            modified: updateResult.modifiedCount
          });
          break;
      }

      // Generate summary
      results.summary = {
        totalProcessed: results.totalProcessed,
        successful: results.successful.length,
        failed: results.failed.length,
        successRate: `${((results.successful.length / results.totalProcessed) * 100).toFixed(2)}%`
      };

      res.json({
        success: true,
        action,
        timestamp: new Date().toISOString(),
        performedBy: req.user.username,
        results
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================================================
  // EXPORT VALIDATION & HELPERS
  // ============================================================================

  static async getExportPreview(req, res, next) {
    try {
      const { 
        status, 
        category, 
        country, 
        dateFrom, 
        dateTo, 
        search, 
        submitter,
        limit = 100
      } = req.query;

      // Build filter query
      const filter = {};
      
      if (status) filter.status = status;
      if (category) filter.category = category;
      if (country) filter.country = country;
      if (submitter) filter.submitter = submitter;
      
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
      }
      
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { publisher: { $regex: search, $options: 'i' } },
          { url: { $regex: search, $options: 'i' } }
        ];
      }

      // Get count and sample data
      const [totalCount, sampleData] = await Promise.all([
        Submission.countDocuments(filter),
        Submission.find(filter)
          .populate('submitter', 'username country')
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
      ]);

      res.json({
        success: true,
        filters: { status, category, country, dateFrom, dateTo, search, submitter },
        totalMatchingRecords: totalCount,
        previewRecords: sampleData.length,
        previewData: sampleData
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AdminController;