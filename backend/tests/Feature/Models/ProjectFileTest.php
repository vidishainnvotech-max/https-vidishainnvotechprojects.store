<?php

namespace Tests\Feature\Models;

use App\Models\Category;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Models\ProjectStage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectFileTest extends TestCase
{
    use RefreshDatabase;

    public function test_stage_zip_exposes_its_project_stage_and_uploader_relationships(): void
    {
        $project = $this->createProject();
        $stage = ProjectStage::create([
            'project_id' => $project->id,
            'stage_percent' => 20,
            'semester' => 'Semester 1',
        ]);
        $uploader = User::factory()->create([
            'mobile' => '9000000001',
            'college_id' => 'test-college',
            'role' => 'admin',
        ]);

        $projectFile = ProjectFile::factory()
            ->for($project)
            ->stage($stage)
            ->create(['uploaded_by' => $uploader->id]);

        $this->assertSame($project->id, $projectFile->project->id);
        $this->assertSame($stage->id, $projectFile->projectStage->id);
        $this->assertSame($uploader->id, $projectFile->uploader->id);
        $this->assertSame($projectFile->id, $stage->fresh()->sourceFile->id);
        $this->assertTrue($projectFile->is_active);
    }

    public function test_complete_zip_is_available_separately_from_stage_files(): void
    {
        $project = $this->createProject();

        $projectFile = ProjectFile::factory()
            ->for($project)
            ->create();

        $this->assertNull($projectFile->project_stage_id);
        $this->assertSame(ProjectFile::TYPE_COMPLETE_ZIP, $projectFile->type);
        $this->assertSame(
            $projectFile->id,
            $project->fresh()->completeProjectFile->id
        );
    }

    private function createProject(): Project
    {
        $category = Category::create([
            'name' => 'Project File Test Category',
            'slug' => 'project-file-test-category',
        ]);

        return Project::create([
            'category_id' => $category->id,
            'title' => 'Project File Test Project',
            'slug' => 'project-file-test-project',
            'abstract' => 'Project used to verify source ZIP metadata.',
            'is_iot' => false,
            'is_active' => true,
        ]);
    }
}
