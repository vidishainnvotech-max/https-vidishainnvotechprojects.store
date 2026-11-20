<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\ProjectIdea;
use App\Services\AdminNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ProjectIdeaController extends Controller
{
    public function index(Request $request)
    {
        $ideas = ProjectIdea::where('user_id', $request->user()->id)
            ->latest()
            ->get()
            ->makeVisible([]);

        $ideas->each(function ($idea) {
            $idea->attachment_available = ! empty($idea->attachment_path);
        });

        return response()->json($ideas);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'min:20', 'max:20000'],
            'whatsapp' => [
                'required',
                'string',
                'max:20',
                'regex:/^[+]?[0-9\s()-]{8,20}$/',
            ],
            'attachment' => [
                'nullable',
                'file',
                'mimes:pdf,doc,docx',
                'max:10240',
            ],
        ]);

        $attachmentPath = null;

        if ($request->hasFile('attachment')) {
            $attachmentPath = $request->file('attachment')->store(
                'project-ideas',
                'local'
            );

            if (! $attachmentPath) {
                throw ValidationException::withMessages([
                    'attachment' => 'Unable to save the attachment. Please try again.',
                ]);
            }
        }

        try {
            $idea = ProjectIdea::create([
                'user_id' => $request->user()->id,
                'title' => trim($validated['title']),
                'description' => trim($validated['description']),
                'whatsapp' => trim($validated['whatsapp']),
                'attachment_path' => $attachmentPath,
            ]);
        } catch (\Throwable $exception) {
            if ($attachmentPath) {
                Storage::disk('local')->delete($attachmentPath);
            }

            throw $exception;
        }

        $idea->attachment_available = ! empty($idea->attachment_path);

        AdminNotificationService::notifyAdmins(
            'project_idea',
            "New Project Idea #{$idea->id}",
            "A student has submitted a new project idea: {$idea->title}.",
            "/admin/ideas/{$idea->id}"
        );

        return response()->json([
            'message' => 'Your project idea has been submitted successfully.',
            'idea' => $idea,
        ], 201);
    }

    public function show(Request $request, int $id)
    {
        $idea = ProjectIdea::where('user_id', $request->user()->id)
            ->findOrFail($id);

        $idea->attachment_available = ! empty($idea->attachment_path);

        return response()->json($idea);
    }
}
