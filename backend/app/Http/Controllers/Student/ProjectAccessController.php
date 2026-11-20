<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectAccessController extends Controller
{
    /**
     * List projects accessible to the authenticated student.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = (int) $request->user()->id;

        $projects = Project::query()
            ->whereHas('userAccess', function ($query) use ($userId) {
                $query->where('user_id', $userId);
            })
            ->with([
                'category:id,name,slug',
                'userAccess' => function ($query) use ($userId) {
                    $query->where('user_id', $userId)
                        ->orderBy('stage_percent');
                },
            ])
            ->get([
                'id',
                'category_id',
                'title',
                'slug',
                'abstract',
                'is_iot',
                'iot_kit_link',
            ]);

        $projects->each(function ($project) use ($userId) {
            $accessStages = $project->userAccess
                ->pluck('stage_percent')
                ->map(fn ($percent) => (int) $percent)
                ->filter(fn ($percent) => $percent >= 0 && $percent <= 100)
                ->unique()
                ->sort()
                ->values();

            // Highest recorded stage is the student's access percentage.
            $highestStage = (int) ($accessStages->max() ?? 0);

            $project->highest_stage = $highestStage;
            $project->access_percent = $highestStage;
            $project->fully_unlocked = $highestStage >= 100;
            $project->access_stages = $accessStages->all();

            $project->unlocked_bundles = $this->getUnlockedBundles(
                $userId,
                (int) $project->id
            );

            // Do not expose the raw access relationship.
            $project->makeHidden('userAccess');
        });

        return response()->json([
            'success' => true,
            'data' => $projects,
        ]);
    }

    /**
     * Show a project and its stage/document unlock status.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $userId = (int) $request->user()->id;

        $project = Project::query()
            ->where('id', $id)
            ->whereHas('userAccess', function ($query) use ($userId) {
                $query->where('user_id', $userId);
            })
            ->with([
                'category:id,name,slug',
                'stages:id,project_id,stage_percent,semester,video_url,ppt_path',
                'stages.sourceFile:id,project_id,project_stage_id,type,original_name,size,is_active',
                'completeProjectFile:id,project_id,project_stage_id,type,original_name,size,is_active',
                'documents:id,project_id,bundle,stage_percent,semester,file_path',
                'userAccess' => function ($query) use ($userId) {
                    $query->where('user_id', $userId)
                        ->orderBy('stage_percent');
                },
            ])
            ->first();

        if (! $project) {
            return response()->json([
                'success' => false,
                'message' => 'Project not found or access denied.',
            ], 404);
        }

        $accessStages = $project->userAccess
            ->pluck('stage_percent')
            ->map(fn ($percent) => (int) $percent)
            ->filter(fn ($percent) => $percent >= 0 && $percent <= 100)
            ->unique()
            ->sort()
            ->values();

        $highestStage = (int) ($accessStages->max() ?? 0);

        $unlockedBundles = $this->getUnlockedBundles(
            $userId,
            (int) $project->id
        );

        $project->access_stages = $accessStages->all();
        $project->highest_stage = $highestStage;
        $project->access_percent = $highestStage;
        $project->fully_unlocked = $highestStage >= 100;
        $project->unlocked_bundles = $unlockedBundles;

        $project->stages->each(function ($stage) use ($accessStages) {
            $requiredStage = (int) $stage->stage_percent;

            $stage->is_unlocked = $requiredStage >= 0
                && $requiredStage <= 100
                && $accessStages->contains($requiredStage);

            $sourceFile = $stage->sourceFile;
            $stage->has_zip = $sourceFile instanceof ProjectFile;
            $stage->source_zip = $stage->is_unlocked && $sourceFile
                ? $this->sourceZipData($sourceFile)
                : null;
            $stage->unsetRelation('sourceFile');

            // Protected resources must be served through authorized endpoints.
            $stage->ppt_path = null;
            $stage->video_url = null;
        });

        $project->documents->each(function ($document) use (
            $accessStages,
            $unlockedBundles
        ) {
            if ($document->stage_percent !== null) {
                $requiredStage = (int) $document->stage_percent;

                $document->is_unlocked = $requiredStage >= 0
                    && $requiredStage <= 100
                    && $accessStages->contains($requiredStage);
            } else {
                $bundle = $document->bundle;

                $document->is_unlocked = is_string($bundle)
                    && $bundle !== ''
                    && in_array($bundle, $unlockedBundles, true);
            }

            // File delivery remains restricted to the download endpoint.
            $document->file_path = null;
        });

        $completeProjectFile = $project->completeProjectFile;
        $completeProjectUnlocked = in_array(
            'complete_project_zip',
            $unlockedBundles,
            true
        );

        $project->complete_project = [
            'is_unlocked' => $completeProjectUnlocked,
            'has_zip' => $completeProjectFile instanceof ProjectFile,
            'source_zip' => $completeProjectUnlocked && $completeProjectFile
                ? $this->sourceZipData($completeProjectFile)
                : null,
        ];
        $project->unsetRelation('completeProjectFile');

        $project->makeHidden('userAccess');

        return response()->json([
            'success' => true,
            'data' => $project,
        ]);
    }

    /**
     * Retrieve bundles explicitly unlocked for this student and project.
     */
    private function getUnlockedBundles(
        int $userId,
        int $projectId
    ): array {
        return DB::table('user_bundle_access')
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->pluck('bundle')
            ->filter(fn ($bundle) => is_string($bundle) && $bundle !== '')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @return array{original_name: string, size: int, download_url: string}
     */
    private function sourceZipData(ProjectFile $projectFile): array
    {
        return [
            'original_name' => $projectFile->original_name,
            'size' => (int) $projectFile->size,
            'download_url' => url(
                "/api/project-files/{$projectFile->id}/download"
            ),
        ];
    }
}
