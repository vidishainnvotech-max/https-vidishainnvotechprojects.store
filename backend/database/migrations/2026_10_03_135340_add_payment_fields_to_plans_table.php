<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->string('code', 50)->unique()->after('name');
            $table->unsignedInteger('installments')->default(1)->after('price');
            $table->json('unlock_map')->nullable()->after('installments');
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropUnique(['code']);
            $table->dropColumn([
                'code',
                'installments',
                'unlock_map',
            ]);
        });
    }
};
