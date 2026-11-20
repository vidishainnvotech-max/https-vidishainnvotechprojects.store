<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProjectIdea;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProjectIdeaController extends Controller
{
    public function index(Request $request)
    {
        $query = ProjectIdea::with('user:id,name,email,mobile')
            ->latest();

        if ($request->filled('search')) {
            $search = $request->string('search')->trim()->toString();

            $query->where(function ($builder) use ($search) {
                $builder->where('title', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        $ideas = $query->paginate(15);

        $ideas->getCollection()->each(function ($idea) {
            $idea->attachment_available = ! empty($idea->attachment_path);
            $idea->makeVisible(['admin_notes']);
        });

        return response()->json($ideas);
    }

    public function show(ProjectIdea $idea)
    {
        $idea->load('user:id,name,email,mobile', 'reviewer:id,name');

        $idea->makeVisible(['attachment_path', 'admin_notes']);
        $idea->attachment_available = ! empty($idea->attachment_path);

        return response()->json($idea);
    }

    public function update(Request $request, ProjectIdea $idea)
    {
        $validated = $request->validate([
            'status' => [
                'sometimes',
                'required',
                Rule::in(['new', 'contacted', 'accepted', 'rejected']),
            ],
            'admin_notes' => ['sometimes', 'nullable', 'string', 'max:10000'],
        ]);

        if (array_key_exists('status', $validated)) {
            $idea->status = $validated['status'];
            $idea->reviewed_by = $request->user()->id;
            $idea->reviewed_at = now();
        }

        if (array_key_exists('admin_notes', $validated)) {
            $idea->admin_notes = $validated['admin_notes'];
        }

        $idea->save();
        $idea->load('user:id,name,email,mobile', 'reviewer:id,name');
        $idea->makeVisible(['attachment_path', 'admin_notes']);
        $idea->attachment_available = ! empty($idea->attachment_path);

        return response()->json([
            'message' => 'Idea review updated successfully.',
            'idea' => $idea,
        ]);
    }

    public function download(ProjectIdea $idea)
    {
        if (! $idea->attachment_path || ! Storage::disk('local')->exists($idea->attachment_path)) {
            return response()->json([
                'message' => 'Attachment not found.',
            ], 404);
        }

        return Storage::disk('local')->download($idea->attachment_path);
    }
}
