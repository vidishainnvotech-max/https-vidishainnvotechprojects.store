<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\DocumentationTemplate;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DocumentationTemplateController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = DocumentationTemplate::query()
            ->where('is_active', true)
            ->where(function ($q) use ($user) {
                $q->whereNull('college_id');

                if ($user->college_id !== null) {
                    $q->orWhere('college_id', $user->college_id);
                }
            })
            ->where(function ($q) use ($user) {
                $q->whereNull('group_id');

                if ($user->group_id !== null) {
                    $q->orWhere('group_id', $user->group_id);
                }
            })
            ->with(['college:id,name', 'group', 'project:id,title,is_iot'])
            ->latest();

        if ($request->filled('search')) {
            $validated = $request->validate(['search' => ['string', 'max:255']]);
            $search = $validated['search'];

            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Project-specific documents are only visible to students who have
        // at least one access record for that project.
        $query->where(function ($q) use ($user) {
            $q->whereNull('project_id')
                ->orWhereHas('project.userAccess', function ($access) use ($user) {
                    $access->where('user_id', $user->id);
                });
        });

        $documents = $query->paginate(100);

        $documents->getCollection()->transform(function ($document) use ($user) {
            $isUnlocked = $this->hasDocumentAccess($user, $document);

            return [
                'id' => $document->id,
                'title' => $document->title,
                'description' => $document->description,
                'file_type' => $document->file_type,
                'college' => $document->college?->name ?? 'All Colleges',
                'group_id' => $document->group_id,
                'project_id' => $document->project_id,
                'project_title' => $document->project?->title,
                'is_iot' => (bool) ($document->project?->is_iot ?? false),
                'stage_percent' => $document->stage_percent,
                'bundle' => $document->bundle,
                'is_unlocked' => $isUnlocked,
                'download_url' => $isUnlocked
                    ? url('/api/student/documentation-templates/'.$document->id.'/download')
                    : null,
                'created_at' => $document->created_at,
            ];
        });

        return response()->json($documents);
    }

    public function download(Request $request, int $id)
    {
        $user = $request->user();

        $document = DocumentationTemplate::query()
            ->where('is_active', true)
            ->where(function ($q) use ($user) {
                $q->whereNull('college_id');

                if ($user->college_id !== null) {
                    $q->orWhere('college_id', $user->college_id);
                }
            })
            ->where(function ($q) use ($user) {
                $q->whereNull('group_id');

                if ($user->group_id !== null) {
                    $q->orWhere('group_id', $user->group_id);
                }
            })
            ->where(function ($q) use ($user) {
                $q->whereNull('project_id')
                    ->orWhereHas('project.userAccess', function ($access) use ($user) {
                        $access->where('user_id', $user->id);
                    });
            })
            ->findOrFail($id);

        abort_unless(
            $this->hasDocumentAccess($user, $document),
            403,
            'You do not have access to this documentation yet.'
        );

        $disk = Storage::disk('local');

        abort_unless(
            $document->file_path && $disk->exists($document->file_path),
            404,
            'Documentation file not found.'
        );

        $extension = strtolower($document->file_type);
        abort_unless(in_array($extension, ['pdf', 'docx'], true), 404, 'Documentation file not found.');

        $filename = preg_replace('/[^A-Za-z0-9._-]/', '_', $document->title);
        $filename = trim((string) $filename, '._-') ?: 'documentation';

        return $disk->download($document->file_path, $filename.'.'.$extension);
    }

    private function hasDocumentAccess(
        User $user,
        DocumentationTemplate $document
    ): bool {
        if ($document->project_id === null) {
            return $document->stage_percent === null
                && ($document->bundle === null || $document->bundle === '');
        }

        if ($document->stage_percent !== null) {
            return $user->userAccess()
                ->where('project_id', $document->project_id)
                ->where('stage_percent', $document->stage_percent)
                ->exists();
        }

        if ($document->bundle !== null && $document->bundle !== '') {
            return DB::table('user_bundle_access')
                ->where('user_id', $user->id)
                ->where('project_id', $document->project_id)
                ->where('bundle', $document->bundle)
                ->exists();
        }

        return $user->userAccess()
            ->where('project_id', $document->project_id)
            ->exists();
    }
}
