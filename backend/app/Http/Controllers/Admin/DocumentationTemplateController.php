<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\DocumentationTemplate;
use App\Models\Group;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DocumentationTemplateController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'college_id' => ['nullable'],
            'group_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = DocumentationTemplate::with([
            'college:id,name',
            'group:id,college_id',
            'project:id,title,is_iot',
        ])->latest();

        if (! empty($validated['search'])) {
            $search = $validated['search'];
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if (array_key_exists('college_id', $validated)) {
            if ($validated['college_id'] === 'generic') {
                $query->whereNull('college_id');
            } elseif ($validated['college_id'] !== null && $validated['college_id'] !== '') {
                $query->where('college_id', $validated['college_id']);
            }
        }

        foreach (['group_id', 'project_id'] as $filter) {
            if (isset($validated[$filter]) && $validated[$filter] !== '') {
                $query->where($filter, $validated[$filter]);
            }
        }

        if (array_key_exists('is_active', $validated)) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        return response()->json($query->paginate($validated['per_page'] ?? 15));
    }

    public function store(Request $request)
    {
        $validated = $this->validateDocument($request, true);
        $file = $request->file('file');
        $path = $file->store('documentation-templates', 'local');

        if (! $path) {
            return response()->json(['message' => 'Unable to upload the document.'], 500);
        }

        try {
            $this->validateAssignments($validated);

            $document = DocumentationTemplate::create([
                ...$this->assignmentFields($validated),
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'file_path' => $path,
                'file_type' => strtolower($file->getClientOriginalExtension()),
                'is_active' => $request->boolean('is_active', true),
            ]);
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($path);
            throw $exception;
        }

        return response()->json([
            'message' => 'Documentation uploaded successfully.',
            'data' => $document->load(['college', 'group', 'project']),
        ], 201);
    }

    public function show(DocumentationTemplate $documentation_template)
    {
        return response()->json([
            'data' => $documentation_template->load(['college', 'group', 'project']),
        ]);
    }

    public function update(Request $request, DocumentationTemplate $documentation_template)
    {
        $validated = $this->validateDocument($request, false);
        $this->validateAssignments($validated, $documentation_template);

        $newPath = null;
        if ($request->hasFile('file')) {
            $newPath = $request->file('file')->store('documentation-templates', 'local');

            if (! $newPath) {
                return response()->json([
                    'message' => 'Unable to upload the replacement document.',
                ], 500);
            }
        }

        $oldPath = $documentation_template->file_path;

        try {
            foreach ([
                'college_id', 'group_id', 'project_id', 'stage_percent', 'bundle',
                'title', 'description',
            ] as $field) {
                if (array_key_exists($field, $validated)) {
                    $documentation_template->{$field} = $validated[$field];
                }
            }

            if ($request->has('is_active')) {
                $documentation_template->is_active = $request->boolean('is_active');
            }

            if ($newPath !== null) {
                $documentation_template->file_path = $newPath;
                $documentation_template->file_type = strtolower(
                    $request->file('file')->getClientOriginalExtension()
                );
            }

            $documentation_template->save();
        } catch (\Throwable $exception) {
            if ($newPath !== null) {
                Storage::disk('local')->delete($newPath);
            }
            throw $exception;
        }

        if ($newPath !== null && $oldPath && $oldPath !== $newPath) {
            Storage::disk('local')->delete($oldPath);
        }

        return response()->json([
            'message' => 'Documentation updated successfully.',
            'data' => $documentation_template->fresh()->load(['college', 'group', 'project']),
        ]);
    }

    public function destroy(DocumentationTemplate $documentation_template)
    {
        $path = $documentation_template->file_path;

        DB::transaction(fn () => $documentation_template->delete());

        if ($path) {
            Storage::disk('local')->delete($path);
        }

        return response()->json(['message' => 'Documentation deleted successfully.']);
    }

    public function colleges()
    {
        return response()->json([
            'data' => College::query()->select('id', 'name')->orderBy('name')->get(),
        ]);
    }

    public function groups()
    {
        return response()->json([
            'data' => Group::query()
                ->with('college:id,name')
                ->orderBy('id')
                ->get(['id', 'college_id', 'member_count']),
        ]);
    }

    public function projects()
    {
        return response()->json([
            'data' => Project::query()
                ->select('id', 'title', 'is_iot', 'kit_price')
                ->orderBy('title')
                ->get(),
        ]);
    }

    public function stages(Request $request)
    {
        $validated = $request->validate([
            'project_id' => ['required', 'integer', Rule::exists('projects', 'id')],
        ]);

        $project = Project::with('stages:id,project_id,stage_percent,semester')
            ->findOrFail($validated['project_id']);

        return response()->json([
            'data' => $project->stages
                ->sortBy('stage_percent')
                ->values()
                ->map(fn ($stage) => [
                    'id' => $stage->id,
                    'stage_percent' => (int) $stage->stage_percent,
                    'semester' => $stage->semester,
                    'label' => trim(
                        ($stage->semester ? $stage->semester.' — ' : '')
                        .(int) $stage->stage_percent.'% unlock'
                    ),
                ]),
        ]);
    }

    private function validateDocument(Request $request, bool $creating): array
    {
        return $request->validate([
            'college_id' => [
                $creating ? 'nullable' : 'sometimes',
                'nullable',
                'integer',
                Rule::exists('colleges', 'id'),
            ],
            'group_id' => [
                $creating ? 'nullable' : 'sometimes',
                'nullable',
                'integer',
                Rule::exists('groups', 'id'),
            ],
            'project_id' => [
                $creating ? 'nullable' : 'sometimes',
                'nullable',
                'integer',
                Rule::exists('projects', 'id'),
            ],
            'stage_percent' => [
                $creating ? 'nullable' : 'sometimes',
                'nullable',
                'integer',
                'min:0',
                'max:100',
            ],
            'bundle' => [
                $creating ? 'nullable' : 'sometimes',
                'nullable',
                'string',
                'max:100',
            ],
            'title' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'file' => [
                $creating ? 'required' : 'sometimes',
                'required_with:file',
                'file',
                'mimes:pdf,docx',
                'max:20480',
            ],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    private function validateAssignments(array $validated, ?DocumentationTemplate $existing = null): void
    {
        $collegeId = array_key_exists('college_id', $validated)
            ? $validated['college_id']
            : $existing?->college_id;
        $groupId = array_key_exists('group_id', $validated)
            ? $validated['group_id']
            : $existing?->group_id;
        $projectId = array_key_exists('project_id', $validated)
            ? $validated['project_id']
            : $existing?->project_id;
        $stagePercent = array_key_exists('stage_percent', $validated)
            ? $validated['stage_percent']
            : $existing?->stage_percent;
        $bundle = array_key_exists('bundle', $validated)
            ? $validated['bundle']
            : $existing?->bundle;

        if ($groupId !== null) {
            $group = Group::findOrFail($groupId);

            if (
                $collegeId === null ||
                (int) $group->college_id !== (int) $collegeId
            ) {
                throw ValidationException::withMessages([
                    'group_id' => 'The selected group must belong to the selected college.',
                ]);
            }
        }

        if (($stagePercent !== null || $bundle !== null) && $projectId === null) {
            throw ValidationException::withMessages([
                'project_id' => 'Select a project when assigning a stage or bundle restriction.',
            ]);
        }

        if ($stagePercent !== null && $bundle !== null && $bundle !== '') {
            throw ValidationException::withMessages([
                'bundle' => 'Choose either a stage or a bundle restriction, not both.',
            ]);
        }

        if ($projectId !== null && $stagePercent !== null) {
            $exists = DB::table('project_stages')
                ->where('project_id', $projectId)
                ->where('stage_percent', $stagePercent)
                ->exists();

            if (! $exists) {
                throw ValidationException::withMessages([
                    'stage_percent' => 'The selected stage does not belong to the selected project.',
                ]);
            }
        }
    }

    private function assignmentFields(array $validated): array
    {
        return [
            'college_id' => $validated['college_id'] ?? null,
            'group_id' => $validated['group_id'] ?? null,
            'project_id' => $validated['project_id'] ?? null,
            'stage_percent' => $validated['stage_percent'] ?? null,
            'bundle' => $validated['bundle'] ?? null,
        ];
    }
}
