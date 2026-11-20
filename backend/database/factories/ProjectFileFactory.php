<?php

namespace Database\Factories;

use App\Models\ProjectFile;
use App\Models\ProjectStage;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ProjectFile>
 */
class ProjectFileFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $filename = fake()->unique()->slug(3).'.zip';

        return [
            'project_stage_id' => null,
            'type' => ProjectFile::TYPE_COMPLETE_ZIP,
            'original_name' => $filename,
            'storage_path' => 'projects/testing/complete/'.Str::uuid().'.zip',
            'size' => fake()->numberBetween(1024, 50 * 1024 * 1024),
            'mime_type' => 'application/zip',
            'sha256' => hash('sha256', fake()->uuid()),
            'is_active' => true,
            'uploaded_by' => null,
        ];
    }

    public function stage(ProjectStage $stage): static
    {
        return $this->state(fn (): array => [
            'project_id' => $stage->project_id,
            'project_stage_id' => $stage->id,
            'type' => ProjectFile::TYPE_STAGE_ZIP,
            'storage_path' => 'projects/'.$stage->project_id.'/stages/'
                .$stage->stage_percent.'/'.Str::uuid().'.zip',
        ]);
    }
}
