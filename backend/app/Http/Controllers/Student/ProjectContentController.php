<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\ProjectDocument;
use App\Models\ProjectStage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProjectContentController extends Controller
{
    public function downloadDocument(
        Request $request,
        int $id
    ): StreamedResponse {
        $document = ProjectDocument::query()->findOrFail($id);

        $userId = (int) $request->user()->id;
        $projectId = (int) $document->project_id;

        $hasStageAccess = $document->stage_percent !== null
            && $this->hasExactProjectStageAccess(
                $request,
                $projectId,
                (int) $document->stage_percent
            );

        $hasBundleAccess = false;

        if (
            $document->bundle !== null
            && $document->bundle !== ''
        ) {
            $hasBundleAccess = DB::table('user_bundle_access')
                ->where('user_id', $userId)
                ->where('project_id', $projectId)
                ->where('bundle', $document->bundle)
                ->exists();
        }

        $hasAccess = $document->stage_percent === null
            ? $hasBundleAccess
            : $hasStageAccess;

        abort_unless(
            $hasAccess,
            403,
            'You do not have access to this document.'
        );

        abort_unless(
            $document->file_path
                && Storage::disk('local')->exists($document->file_path),
            404,
            'Document not found.'
        );

        return Storage::disk('local')->download(
            $document->file_path
        );
    }

    public function downloadPpt(
        Request $request,
        int $id
    ): StreamedResponse {
        $stage = ProjectStage::query()->findOrFail($id);

        abort_unless(
            $this->hasExactProjectStageAccess(
                $request,
                (int) $stage->project_id,
                $stage->stage_percent
            ),
            403,
            'You do not have access to this stage.'
        );

        abort_unless(
            $stage->ppt_path
                && Storage::disk('local')->exists($stage->ppt_path),
            404,
            'Presentation not found.'
        );

        return Storage::disk('local')->download(
            $stage->ppt_path
        );
    }

    public function watchStageVideo(
        Request $request,
        int $id
    ): JsonResponse {
        $stage = ProjectStage::query()->findOrFail($id);

        abort_unless(
            $this->hasExactProjectStageAccess(
                $request,
                (int) $stage->project_id,
                $stage->stage_percent
            ),
            403,
            'You do not have access to this stage.'
        );

        abort_unless(
            $stage->video_url,
            404,
            'Video not found.'
        );

        return response()->json([
            'success' => true,
            'data' => [
                'stage_id' => $stage->id,
                'stage_percent' => $stage->stage_percent,
                'video_url' => $stage->video_url,
            ],
        ]);
    }

    private function hasExactProjectStageAccess(
        Request $request,
        int $projectId,
        ?int $requiredStagePercent
    ): bool {
        if ($requiredStagePercent === null) {
            return false;
        }

        return $request->user()
            ->userAccess()
            ->where('project_id', $projectId)
            ->where('stage_percent', $requiredStagePercent)
            ->exists();
    }
}
