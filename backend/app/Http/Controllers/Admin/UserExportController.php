<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UserExportController extends Controller
{
    public function export(Request $request): StreamedResponse
    {
        $search = trim((string) $request->query('search', ''));

        $users = User::query()
            ->select([
                'id',
                'name',
                'email',
                'mobile',
                'college_id',
                'role',
                'created_at',
            ])
            ->with([
                'userAccess' => function ($query) {
                    $query->with('project:id,title,slug')
                        ->orderBy('stage_percent');
                },
            ])
            ->when($search !== '', function ($query) use ($search) {
                $like = '%'.$search.'%';

                $query->where(function ($inner) use ($like) {
                    $inner->where('name', 'like', $like)
                        ->orWhere('email', 'like', $like)
                        ->orWhere('mobile', 'like', $like)
                        ->orWhere('college_id', 'like', $like);
                });
            })
            ->latest('created_at')
            ->cursor();

        $filename = 'users-export-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($users) {
            $handle = fopen('php://output', 'w');

            // UTF-8 BOM so Excel opens the file correctly
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, [
                'id',
                'name',
                'email',
                'mobile',
                'college_id',
                'role',
                'created_at',
                'access',
            ]);

            foreach ($users as $user) {
                $access = $user->userAccess
                    ->groupBy('project_id')
                    ->map(function ($rows) {
                        $project = $rows->first()->project;

                        $stages = $rows
                            ->pluck('stage_percent')
                            ->map(fn ($stage) => (int) $stage)
                            ->implode(',');

                        return sprintf(
                            '%s: %s',
                            $project?->title ?? 'Unknown project',
                            $stages,
                        );
                    })
                    ->implode(' | ');

                fputcsv($handle, [
                    $user->id,
                    $this->guard($user->name),
                    $this->guard($user->email),
                    $this->guard((string) $user->mobile),
                    $this->guard((string) $user->college_id),
                    $user->role,
                    $user->created_at?->format('Y-m-d H:i:s') ?? '',
                    $this->guard($access),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function guard(string $value): string
    {
        if ($value !== '' && preg_match('/^[=+\-@\t\r]/', $value)) {
            return "'".$value;
        }

        return $value;
    }
}
