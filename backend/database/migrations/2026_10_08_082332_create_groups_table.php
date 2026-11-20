<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('groups', function (Blueprint $table) {
            $table->id();

            $table->foreignId('college_id')
                ->nullable()
                ->constrained('colleges')
                ->nullOnDelete();

            $table->unsignedTinyInteger('member_count');

            $table->string('pincode', 10);
            $table->string('whatsapp', 20);

            $table->string('guide_name');
            $table->string('guide_mobile', 20);

            $table->string('second_guide_name')->nullable();
            $table->string('second_guide_mobile', 20)->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('groups');
    }
};
