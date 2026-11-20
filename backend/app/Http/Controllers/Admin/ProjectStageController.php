<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProjectFile;
use App\Models\ProjectStage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProjectStageController extends Controller
{
    /**
     * List all project stages.
     */
    public function index()
    {
        return response()->json(
            ProjectStage::with('project')
                ->orderBy('project_id')
                ->orderBy('stage_percent')
                ->get()
        );
    }

    /**
     * Create a stage for a project.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_id' => [
                'required',
                'integer',
                'exists:projects,id',
            ],
            'stage_percent' => [
                'required',
                'integer',
                Rule::in([20, 50, 75, 100]),
            ],
            'semester' => ['nullable', 'string', 'max:255'],
            'video_url' => ['nullable', 'url', 'max:255'],
            'ppt_path' => ['nullable', 'string', 'max:255'],
        ], [
            'project_id.required' => 'Please select a project.',
            'project_id.exists' => 'The selected project does not exist.',
            'stage_percent.in' => 'Stage percentage must be 20, 50, 75, or 100.',
        ]);

        $duplicate = ProjectStage::query()
            ->where('project_id', $validated['project_id'])
            ->where('stage_percent', $validated['stage_percent'])
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => 'This stage already exists for the selected project.',
            ], 422);
        }

        $stage = ProjectStage::create($validated);

        return response()->json([
            'message' => 'Project stage created successfully.',
            'data' => $stage->load('project'),
        ], 201);
    }

    /**
     * View one project stage.
     */
    public function show(ProjectStage $stage)
    {
        return response()->json([
            'data' => $stage->load('project'),
        ]);
    }

    /**
     * Update an existing project stage.
     */
    public function update(Request $request, ProjectStage $stage)
    {
        $validated = $request->validate([
            'project_id' => [
                'required',
                'integer',
                'exists:projects,id',
            ],
            'stage_percent' => [
                'required',
                'integer',
                Rule::in([20, 50, 75, 100]),
            ],
            'semester' => ['nullable', 'string', 'max:255'],
            'video_url' => ['nullable', 'url', 'max:255'],
            'ppt_path' => ['nullable', 'string', 'max:255'],
        ], [
            'project_id.required' => 'Please select a project.',
            'project_id.exists' => 'The selected project does not exist.',
            'stage_percent.in' => 'Stage percentage must be 20, 50, 75, or 100.',
        ]);

        $duplicate = ProjectStage::query()
            ->where('project_id', $validated['project_id'])
            ->where('stage_percent', $validated['stage_percent'])
            ->where('id', '!=', $stage->id)
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => 'This stage already exists for the selected project.',
            ], 422);
        }

        $stage->update($validated);

        return response()->json([
            'message' => 'Project stage updated successfully.',
            'data' => $stage->fresh()->load('project'),
        ]);
    }

    /**
     * Delete a project stage.
     */
    public function destroy(ProjectStage $stage)
    {
        $storagePaths = ProjectFile::query()
            ->where('project_stage_id', $stage->id)
            ->pluck('storage_path')
            ->all();

        DB::transaction(fn () => $stage->delete());

        if ($storagePaths !== []) {
            Storage::disk('local')->delete($storagePaths);
        }

        return response()->json([
            'message' => 'Project stage deleted successfully.',
        ]);
    }
}
