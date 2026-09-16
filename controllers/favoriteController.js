const mongoose = require("mongoose");
const Favorite = require("../models/Favorite");

/**
 * Add a recipe to user favorites
 * Route: POST /favorites
 */
const addFavorite = async (req, res, next) => {
  try {
    const { recipeId, userEmail } = req.body;

    if (!recipeId || !userEmail) {
      return res.status(400).send({
        success: false,
        message: "Recipe ID and user email are required",
      });
    }

    const exist = await Favorite.findOne({ recipeId, userEmail });
    if (exist) {
      return res.send({
        success: false,
        message: "Already in favorites!",
      });
    }

    const result = await Favorite.create({
      recipeId,
      userEmail,
      createdAt: new Date(),
    });

    if (result._id) {
      return res.send({
        success: true,
        message: "Added to favorites!",
      });
    } else {
      return res.send({
        success: false,
        message: "Failed to add!",
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get all favorites for a user with populated recipe details
 * Route: GET /favorites?email=...
 */
const getFavorites = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({
        success: false,
        message: "Email required",
      });
    }

    const cleanEmail = email.trim();
    const escapeRegex = (str) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const emailRegex = new RegExp("^" + escapeRegex(cleanEmail) + "$", "i");

    const pipeline = [
      { $match: { userEmail: emailRegex } },
      {
        $addFields: {
          convertedRecipeId: {
            $cond: {
              if: { $eq: [{ $type: "$recipeId" }, "objectId"] },
              then: "$recipeId",
              else: {
                $cond: {
                  if: {
                    $regexMatch: {
                      input: { $toString: { $ifNull: ["$recipeId", ""] } },
                      regex: /^[0-9a-fA-F]{24}$/,
                    },
                  },
                  then: { $toObjectId: { $toString: "$recipeId" } },
                  else: "$recipeId",
                },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "recipes",
          localField: "convertedRecipeId",
          foreignField: "_id",
          as: "recipeDetails",
        },
      },
      {
        $addFields: {
          recipeInfo: { $arrayElemAt: ["$recipeDetails", 0] },
        },
      },
      {
        $project: {
          recipeDetails: 0,
          convertedRecipeId: 0,
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const result = await Favorite.aggregate(pipeline);
    res.send({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a favorite by ID
 * Route: DELETE /favorites/:id
 */
const deleteFavorite = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await Favorite.deleteOne({ _id: id });
    res.send({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addFavorite,
  getFavorites,
  deleteFavorite,
};
