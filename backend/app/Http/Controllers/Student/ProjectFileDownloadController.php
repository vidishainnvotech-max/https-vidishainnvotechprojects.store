<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\ProjectFile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProjectFileDownloadController extends Controller
{
    private const COMPLETE_PROJECT_BUNDLE = 'complete_project_zip';

    public function __invoke(
        Request $request,
        ProjectFile $projectFile
    ): StreamedResponse {
        abort_unless(
            $projectFile->is_active
                && in_array($projectFile->type, [
                    ProjectFile::TYPE_STAGE_ZIP,
                    ProjectFile::TYPE_COMPLETE_ZIP,
                ], true),
            404,
            'Project ZIP not found.'
        );

        $projectFile->loadMissing(
            'projectStage:id,project_id,stage_percent'
        );

        abort_unless(
            $this->hasAccess($request->user(), $projectFile),
            403,
            'You do not have access to this project ZIP.'
        );

        abort_unless(
            Storage::disk('local')->exists($projectFile->storage_path),
            404,
            'Project ZIP not found.'
        );

        return Storage::disk('local')->download(
            $projectFile->storage_path,
            $this->downloadName($projectFile),
            ['Content-Type' => 'application/zip']
        );
    }

    private function hasAccess(User $user, ProjectFile $projectFile): bool
    {
        if ($projectFile->type === ProjectFile::TYPE_STAGE_ZIP) {
            $stage = $projectFile->projectStage;

            if (
                ! $stage
                || (int) $stage->project_id !== (int) $projectFile->project_id
            ) {
                abort(404, 'Project ZIP not found.');
            }

            return $user->userAccess()
                ->where('project_id', $projectFile->project_id)
                ->where('stage_percent', $stage->stage_percent)
                ->exists();
        }

        if ($projectFile->project_stage_id !== null) {
            abort(404, 'Project ZIP not found.');
        }

        return DB::table('user_bundle_access')
            ->where('user_id', $user->id)
            ->where('project_id', $projectFile->project_id)
            ->where('bundle', self::COMPLETE_PROJECT_BUNDLE)
            ->exists();
    }

    private function downloadName(ProjectFile $projectFile): string
    {
        $filename = basename(str_replace(
            '\\',
            '/',
            $projectFile->original_name
        ));
        $filename = preg_replace('/[^A-Za-z0-9._-]/', '_', $filename);
        $filename = trim((string) $filename, '._-') ?: 'project-source';

        return Str::endsWith(Str::lower($filename), '.zip')
            ? $filename
            : $filename.'.zip';
    }
}
