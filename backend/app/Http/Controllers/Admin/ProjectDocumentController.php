<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProjectDocument;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProjectDocumentController extends Controller
{
    public function index()
    {
        return response()->json(
            ProjectDocument::with('project')->latest()->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'bundle' => ['required', 'string', 'max:255'],
            'stage_percent' => ['nullable', 'integer', Rule::in([20, 50, 75, 100])],
            'semester' => ['nullable', 'string', 'max:255'],
            'file_path' => ['required', 'string', 'max:255'],
        ]);

        $exists = ProjectDocument::where('project_id', $validated['project_id'])
            ->where('bundle', $validated['bundle'])
            ->where('stage_percent', $validated['stage_percent'] ?? null)
            ->where('semester', $validated['semester'] ?? null)
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'This document already exists for the project.',
            ], 422);
        }

        $document = ProjectDocument::create($validated);

        return response()->json(
            $document->load('project'),
            201
        );
    }

    public function show(ProjectDocument $document)
    {
        return response()->json(
            $document->load('project')
        );
    }

    public function update(Request $request, ProjectDocument $document)
    {
        $validated = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'bundle' => ['required', 'string', 'max:255'],
            'stage_percent' => ['nullable', 'integer', Rule::in([20, 50, 75, 100])],
            'semester' => ['nullable', 'string', 'max:255'],
            'file_path' => ['required', 'string', 'max:255'],
        ]);

        $exists = ProjectDocument::where('project_id', $validated['project_id'])
            ->where('bundle', $validated['bundle'])
            ->where('stage_percent', $validated['stage_percent'] ?? null)
            ->where('semester', $validated['semester'] ?? null)
            ->where('id', '!=', $document->id)
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'This document already exists for the project.',
            ], 422);
        }

        $document->update($validated);

        return response()->json(
            $document->fresh()->load('project')
        );
    }

    public function destroy(ProjectDocument $document)
    {
        $document->delete();

        return response()->json([
            'message' => 'Project document deleted successfully.',
        ]);
    }
}
