<?php

namespace App\Http\Controllers;

use App\Models\College;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CollegeController extends Controller
{
    /**
     * Return colleges for the registration form's searchable dropdown.
     *
     * Response shape remains:
     * {
     *   "data": [
     *     { "id": 1, "name": "College name" }
     *   ]
     * }
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        $search = trim((string) ($validated['search'] ?? ''));

        $query = College::query()
            ->select(['id', 'name'])
            ->orderBy('name');

        if ($search !== '') {
            $query->where('name', 'like', '%'.$search.'%');
        }

        $colleges = $query
            ->limit(20)
            ->get();

        return response()->json([
            'data' => $colleges,
        ]);
    }
}
