<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Support\Facades\Storage;

class ProjectController extends Controller
{
    public function index()
    {
        $projects = Project::with('category:id,name,slug')
            ->where('is_active', true)
            ->latest()
            ->get([
                'id',
                'category_id',
                'title',
                'slug',
                'abstract',
                'is_iot',
                'iot_kit_link',
                'kit_price',
                'image',
                'project_type',
                'level',
                'cut_price',
                'offer_price',
                'is_active',
            ]);

        $projects->transform(function ($project) {
            $project->image_url = $project->image
                ? Storage::disk('public')->url($project->image)
                : null;

            return $project;
        });

        return response()->json($projects);
    }

    public function show(string $slug)
    {
        $project = Project::select([
            'id',
            'category_id',
            'title',
            'slug',
            'abstract',
            'is_iot',
            'iot_kit_link',
            'kit_price',
            'image',
            'project_type',
            'level',
            'cut_price',
            'offer_price',
            'is_active',
        ])->with([
            'category:id,name,slug',
            'stages:id,project_id,stage_percent,semester',
            'documents:id,project_id,bundle,stage_percent,semester',
        ])
            ->where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        $project->image_url = $project->image
            ? Storage::disk('public')->url($project->image)
            : null;

        return response()->json($project);
    }
}
