<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProjectController extends Controller
{
    public function index()
    {
        $projects = Project::with('category')->latest()->get();

        $projects->transform(function ($project) {
            $project->image_url = $this->getImageUrl($project);

            return $project;
        });

        return response()->json($projects);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'category_id' => ['required', 'exists:categories,id'],
            'title' => ['required', 'string', 'max:255'],
            'slug' => [
                'nullable',
                'string',
                'max:255',
                'unique:projects,slug',
            ],
            'abstract' => ['nullable', 'string'],

            'project_type' => [
                'sometimes',
                'required',
                Rule::in(['standard', 'diploma_mini']),
            ],
            'level' => ['nullable', 'string', 'max:100'],
            'cut_price' => [
                'nullable',
                'numeric',
                'min:0',
                'max:99999999.99',
            ],
            'offer_price' => [
                'nullable',
                'numeric',
                'min:0',
                'max:99999999.99',
            ],
            'is_active' => ['sometimes', 'boolean'],

            'is_iot' => ['sometimes', 'boolean'],
            'iot_kit_link' => ['nullable', 'url', 'max:255'],
            'kit_price' => [
                'nullable',
                'numeric',
                'gt:0',
                'max:99999999.99',
            ],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        $this->validateProjectPricing($validated);

        $isIot = $request->boolean('is_iot');
        $imagePath = null;

        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store(
                'projects',
                'public'
            );

            if (! $imagePath) {
                return response()->json([
                    'message' => 'Unable to save the project image.',
                ], 500);
            }
        }

        try {
            $project = Project::create([
                'category_id' => $validated['category_id'],
                'title' => $validated['title'],
                'slug' => $validated['slug'] ?? $this->makeUniqueSlug(
                    $validated['title']
                ),
                'abstract' => $validated['abstract'] ?? null,

                'project_type' => $validated['project_type'] ?? 'standard',
                'level' => $validated['level'] ?? null,
                'cut_price' => $validated['cut_price'] ?? null,
                'offer_price' => $validated['offer_price'] ?? null,
                'is_active' => $request->has('is_active')
                    ? $request->boolean('is_active')
                    : true,

                'is_iot' => $isIot,
                'iot_kit_link' => $isIot
                    ? ($validated['iot_kit_link'] ?? null)
                    : null,
                'kit_price' => $isIot
                    ? ($validated['kit_price'] ?? null)
                    : null,

                'image' => $imagePath,
            ]);
        } catch (\Throwable $exception) {
            if ($imagePath) {
                Storage::disk('public')->delete($imagePath);
            }

            throw $exception;
        }

        $project->load('category');
        $project->image_url = $this->getImageUrl($project);

        return response()->json($project, 201);
    }

    public function show(Project $project)
    {
        $project->load('category');
        $project->image_url = $this->getImageUrl($project);

        return response()->json($project);
    }

    public function update(Request $request, Project $project)
    {
        $validated = $request->validate([
            'category_id' => ['required', 'exists:categories,id'],
            'title' => ['required', 'string', 'max:255'],
            'slug' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('projects', 'slug')->ignore($project->id),
            ],
            'abstract' => ['nullable', 'string'],

            'project_type' => [
                'sometimes',
                'required',
                Rule::in(['standard', 'diploma_mini']),
            ],
            'level' => ['nullable', 'string', 'max:100'],
            'cut_price' => [
                'nullable',
                'numeric',
                'min:0',
                'max:99999999.99',
            ],
            'offer_price' => [
                'nullable',
                'numeric',
                'min:0',
                'max:99999999.99',
            ],
            'is_active' => ['sometimes', 'boolean'],

            'is_iot' => ['sometimes', 'boolean'],
            'iot_kit_link' => ['nullable', 'url', 'max:255'],
            'kit_price' => [
                'nullable',
                'numeric',
                'gt:0',
                'max:99999999.99',
            ],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        $this->validateProjectPricing($validated, $project);

        $isIot = $request->has('is_iot')
            ? $request->boolean('is_iot')
            : (bool) $project->is_iot;

        $oldImagePath = $project->image;
        $newImagePath = null;
        $imagePath = $oldImagePath;

        if ($request->hasFile('image')) {
            $newImagePath = $request->file('image')->store(
                'projects',
                'public'
            );

            if (! $newImagePath) {
                return response()->json([
                    'message' => 'Unable to save the replacement image.',
                ], 500);
            }

            $imagePath = $newImagePath;
        }

        $updates = [
            'category_id' => $validated['category_id'],
            'title' => $validated['title'],
            'slug' => $validated['slug'] ?? $this->makeUniqueSlug(
                $validated['title'],
                $project->id
            ),
            'abstract' => $validated['abstract'] ?? null,

            'is_iot' => $isIot,
            'iot_kit_link' => $isIot
                ? ($validated['iot_kit_link'] ?? null)
                : null,
            'kit_price' => $isIot
                ? (
                    array_key_exists('kit_price', $validated)
                        ? $validated['kit_price']
                        : $project->kit_price
                )
                : null,

            'image' => $imagePath,
        ];

        foreach ([
            'project_type',
            'level',
            'cut_price',
            'offer_price',
            'is_active',
        ] as $field) {
            if (array_key_exists($field, $validated)) {
                $updates[$field] = $validated[$field];
            }
        }

        if (array_key_exists('is_active', $validated)) {
            $updates['is_active'] = $request->boolean('is_active');
        }

        try {
            $project->update($updates);
        } catch (\Throwable $exception) {
            if ($newImagePath) {
                Storage::disk('public')->delete($newImagePath);
            }

            throw $exception;
        }

        if (
            $newImagePath &&
            $oldImagePath &&
            $oldImagePath !== $newImagePath
        ) {
            Storage::disk('public')->delete($oldImagePath);
        }

        $project->refresh()->load('category');
        $project->image_url = $this->getImageUrl($project);

        return response()->json($project);
    }

    public function destroy(Project $project)
    {
        if ($project->orders()->exists() || $project->userAccess()->exists()) {
            return response()->json([
                'message' => 'This project has orders or student access and cannot be deleted.',
            ], 422);
        }

        $imagePath = $project->image;
        $projectFilePaths = $project->projectFiles()
            ->pluck('storage_path')
            ->all();

        DB::transaction(function () use ($project) {
            $project->stages()->delete();
            $project->documents()->delete();
            $project->delete();
        });

        if ($projectFilePaths !== []) {
            Storage::disk('local')->delete($projectFilePaths);
        }

        if ($imagePath) {
            Storage::disk('public')->delete($imagePath);
        }

        return response()->json([
            'message' => 'Project deleted successfully.',
        ]);
    }

    private function validateProjectPricing(
        array $validated,
        ?Project $project = null
    ): void {
        $projectType = $validated['project_type']
            ?? $project?->project_type
            ?? 'standard';

        if ($projectType !== 'diploma_mini') {
            return;
        }

        $cutPrice = array_key_exists('cut_price', $validated)
            ? $validated['cut_price']
            : $project?->cut_price;

        $offerPrice = array_key_exists('offer_price', $validated)
            ? $validated['offer_price']
            : $project?->offer_price;

        if (
            $cutPrice !== null &&
            $offerPrice !== null &&
            (float) $offerPrice >= (float) $cutPrice
        ) {
            throw ValidationException::withMessages([
                'offer_price' => [
                    'The offer price must be less than the cut price.',
                ],
            ]);
        }
    }

    private function getImageUrl(Project $project): ?string
    {
        if (! $project->image) {
            return null;
        }

        return Storage::disk('public')->url($project->image);
    }

    private function makeUniqueSlug(
        string $title,
        ?int $ignoreProjectId = null
    ): string {
        $baseSlug = Str::slug($title);

        if ($baseSlug === '') {
            $baseSlug = 'project';
        }

        $slug = $baseSlug;
        $counter = 2;

        while (
            Project::where('slug', $slug)
                ->when(
                    $ignoreProjectId !== null,
                    fn ($query) => $query->where(
                        'id',
                        '!=',
                        $ignoreProjectId
                    )
                )
                ->exists()
        ) {
            $slug = $baseSlug.'-'.$counter;
            $counter++;
        }

        return $slug;
    }
}
