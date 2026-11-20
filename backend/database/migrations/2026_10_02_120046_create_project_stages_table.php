<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('project_stages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->unsignedTinyInteger('stage_percent');
            $table->string('semester')->nullable();
            $table->string('video_url')->nullable();
            $table->string('ppt_path')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'stage_percent']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_stages');
    }
};
