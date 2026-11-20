<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Models\ProjectStage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class ProjectFileController extends Controller
{
    private const MAX_ZIP_SIZE_KILOBYTES = 512000;

    public function index(Project $project): JsonResponse
    {
        $files = $project->projectFiles()
            ->where('is_active', true)
            ->with([
                'projectStage:id,project_id,stage_percent,semester',
                'uploader:id,name',
            ])
            ->get();

        $stageFiles = $files
            ->where('type', ProjectFile::TYPE_STAGE_ZIP)
            ->sortBy(fn (ProjectFile $file): int => (int) $file->projectStage?->stage_percent)
            ->values()
            ->map(fn (ProjectFile $file): array => $this->fileData($file))
            ->all();

        $completeFile = $files->firstWhere(
            'type',
            ProjectFile::TYPE_COMPLETE_ZIP
        );

        return response()->json([
            'data' => [
                'project' => [
                    'id' => $project->id,
                    'title' => $project->title,
                ],
                'stage_files' => $stageFiles,
                'complete_file' => $completeFile instanceof ProjectFile
                    ? $this->fileData($completeFile)
                    : null,
            ],
        ]);
    }

    public function storeStage(Request $request, Project $project): JsonResponse
    {
        $validated = $request->validate([
            'stage_id' => ['required', 'integer', 'exists:project_stages,id'],
            'file' => $this->zipRules(),
        ]);

        $stage = $project->stages()
            ->whereKey($validated['stage_id'])
            ->first();

        if (! $stage) {
            throw ValidationException::withMessages([
                'stage_id' => 'The selected stage does not belong to this project.',
            ]);
        }

        $projectFile = $this->storeOrReplace(
            $project,
            $stage,
            $request->file('file'),
            ProjectFile::TYPE_STAGE_ZIP,
            (int) $request->user()->id
        );

        return response()->json([
            'message' => 'Stage source ZIP uploaded successfully.',
            'data' => $this->fileData($projectFile),
        ], 201);
    }

    public function storeComplete(Request $request, Project $project): JsonResponse
    {
        $request->validate([
            'file' => $this->zipRules(),
        ]);

        $projectFile = $this->storeOrReplace(
            $project,
            null,
            $request->file('file'),
            ProjectFile::TYPE_COMPLETE_ZIP,
            (int) $request->user()->id
        );

        return response()->json([
            'message' => 'Complete project ZIP uploaded successfully.',
            'data' => $this->fileData($projectFile),
        ], 201);
    }

    public function destroy(ProjectFile $projectFile): JsonResponse
    {
        $storagePath = $projectFile->storage_path;

        DB::transaction(fn () => $projectFile->delete());
        Storage::disk('local')->delete($storagePath);

        return response()->json([
            'message' => 'Project ZIP removed successfully.',
        ]);
    }

    /**
     * @return array<int, string>
     */
    private function zipRules(): array
    {
        return [
            'required',
            'file',
            'mimes:zip',
            'extensions:zip',
            'max:'.self::MAX_ZIP_SIZE_KILOBYTES,
        ];
    }

    private function storeOrReplace(
        Project $project,
        ?ProjectStage $stage,
        UploadedFile $uploadedFile,
        string $type,
        int $uploaderId
    ): ProjectFile {
        $temporaryPath = $uploadedFile->getRealPath();
        $sha256 = is_string($temporaryPath)
            ? hash_file('sha256', $temporaryPath)
            : false;

        if (! is_string($sha256)) {
            throw new RuntimeException('Unable to calculate the ZIP checksum.');
        }

        $directory = $stage
            ? "projects/{$project->id}/stages/{$stage->stage_percent}"
            : "projects/{$project->id}/complete";

        $storagePath = $uploadedFile->storeAs(
            $directory,
            Str::uuid().'.zip',
            'local'
        );

        if (! is_string($storagePath)) {
            throw new RuntimeException('Unable to store the project ZIP.');
        }

        $originalName = basename(str_replace(
            '\\',
            '/',
            $uploadedFile->getClientOriginalName()
        ));

        try {
            [$projectFile, $replacedPaths] = DB::transaction(function () use (
                $project,
                $stage,
                $type,
                $uploadedFile,
                $uploaderId,
                $storagePath,
                $sha256,
                $originalName
            ): array {
                if ($stage) {
                    ProjectStage::query()
                        ->whereKey($stage->id)
                        ->lockForUpdate()
                        ->firstOrFail();
                } else {
                    Project::query()
                        ->whereKey($project->id)
                        ->lockForUpdate()
                        ->firstOrFail();
                }

                $activeFilesQuery = ProjectFile::query()
                    ->where('project_id', $project->id)
                    ->where('type', $type)
                    ->where('is_active', true);

                if ($stage) {
                    $activeFilesQuery->where('project_stage_id', $stage->id);
                } else {
                    $activeFilesQuery->whereNull('project_stage_id');
                }

                $activeFiles = $activeFilesQuery
                    ->lockForUpdate()
                    ->get();

                if ($activeFiles->isNotEmpty()) {
                    ProjectFile::query()
                        ->whereKey($activeFiles->modelKeys())
                        ->update(['is_active' => false]);
                }

                $projectFile = ProjectFile::create([
                    'project_id' => $project->id,
                    'project_stage_id' => $stage?->id,
                    'type' => $type,
                    'original_name' => Str::limit($originalName, 255, ''),
                    'storage_path' => $storagePath,
                    'size' => (int) $uploadedFile->getSize(),
                    'mime_type' => (string) $uploadedFile->getMimeType(),
                    'sha256' => $sha256,
                    'is_active' => true,
                    'uploaded_by' => $uploaderId,
                ]);

                return [
                    $projectFile,
                    $activeFiles->pluck('storage_path')->all(),
                ];
            });
        } catch (Throwable $exception) {
            Storage::disk('local')->delete($storagePath);

            throw $exception;
        }

        if ($replacedPaths !== []) {
            Storage::disk('local')->delete($replacedPaths);
        }

        return $projectFile->load([
            'projectStage:id,project_id,stage_percent,semester',
            'uploader:id,name',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function fileData(ProjectFile $projectFile): array
    {
        return [
            'id' => $projectFile->id,
            'project_id' => $projectFile->project_id,
            'type' => $projectFile->type,
            'original_name' => $projectFile->original_name,
            'size' => $projectFile->size,
            'mime_type' => $projectFile->mime_type,
            'sha256' => $projectFile->sha256,
            'is_active' => $projectFile->is_active,
            'stage' => $projectFile->projectStage
                ? [
                    'id' => $projectFile->projectStage->id,
                    'stage_percent' => $projectFile->projectStage->stage_percent,
                    'semester' => $projectFile->projectStage->semester,
                ]
                : null,
            'uploader' => $projectFile->uploader
                ? [
                    'id' => $projectFile->uploader->id,
                    'name' => $projectFile->uploader->name,
                ]
                : null,
            'created_at' => $projectFile->created_at,
            'updated_at' => $projectFile->updated_at,
        ];
    }
}
