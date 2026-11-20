<?php

namespace Database\Seeders;

use App\Models\College;
use Illuminate\Database\Seeder;

class CollegeSeeder extends Seeder
{
    public function run(): void
    {
        $colleges = [
            'Gokhale Education Society R. H. Sapat College of Engineering, Nashik',
            'K. K. Wagh Institute of Engineering Education and Research, Nashik',
            'K. K. Wagh College of Engineering, Nashik',
            'Sandip Institute of Technology and Research Centre, Nashik',
            'Matoshri College of Engineering and Research Centre, Nashik',
        ];

        foreach ($colleges as $name) {
            College::firstOrCreate([
                'name' => $name,
            ]);
        }
    }
}
