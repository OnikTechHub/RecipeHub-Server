const mongoose = require("mongoose");
const Report = require("../models/Report");
const Recipe = require("../models/Recipe");

/**
 * Submit a report for a recipe
 * Route: POST /reports
 */
const createReport = async (req, res, next) => {
  try {
    const { recipeId, recipeName, reporterEmail, reason, details } = req.body;

    if (!recipeId || !reason) {
      return res.status(400).send({
        success: false,
        message: "Recipe ID and Reason are required.",
      });
    }

    const reportData = {
      recipeId,
      recipeName: recipeName || "Unknown Recipe",
      reporterEmail: reporterEmail || "Anonymous",
      reason,
      details: details || "",
      reportedAt: new Date(),
    };

    const result = await Report.create(reportData);
    res.status(201).send({
      success: true,
      insertedId: result._id,
      message: "Report submitted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all reports with aggregated recipe details
 * Route: GET /reports
 */
const getAllReports = async (req, res, next) => {
  try {
    const result = await Report.aggregate([
      {
        $addFields: {
          recipeObjectId: {
            $cond: {
              if: {
                $regexMatch: {
                  input: "$recipeId",
                  regex: /^[0-9a-fA-F]{24}$/,
                },
              },
              then: { $toObjectId: "$recipeId" },
              else: "$recipeId",
            },
          },
        },
      },
      {
        $lookup: {
          from: "recipes",
          localField: "recipeObjectId",
          foreignField: "_id",
          as: "recipeDetails",
        },
      },
      {
        $unwind: {
          path: "$recipeDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      { $sort: { reportedAt: -1 } },
    ]);

    res.send(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a report, with optional cascade recipe deletion
 * Route: DELETE /reports/:id?action=delete&recipeId=...
 */
const deleteReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, recipeId } = req.query;

    if (action === "delete" && recipeId) {
      await Recipe.deleteOne({ _id: recipeId });
    }

    const result = await Report.deleteOne({ _id: id });
    res.send({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReport,
  getAllReports,
  deleteReport,
};
