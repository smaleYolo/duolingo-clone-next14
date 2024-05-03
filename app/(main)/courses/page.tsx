import React from 'react';
import {getCourses, getUserProgress} from "@/db/queries";
import List from "@/app/(main)/courses/list";
import Image from "next/image";

const CoursesPage = async () => {
    const coursesData = getCourses();
    const userProgressData = getUserProgress();

    const [courses, userProgress] = await Promise.all([
        coursesData, userProgressData
    ])

    return (
        <div className='h-full max-w-[912px] px-3 mx-auto'>
            <h1 className='text-2xl font-bold text-neutral-700'>
                Language Courses
            </h1>
            {courses.length ? (
                <List
                    courses={courses}
                    activeCourseId={userProgress?.activeCourseId}
                />
            ) : (
                <div className='w-full h-full flex flex-col items-center justify-center text-center gap-y-4'>
                    <Image
                        src='/mascot_sad.svg'
                        alt='No courses'
                        height={120}
                        width={120}
                    />
                    <p className='text-xl font-bold text-neutral-700'>
                        There are no available courses here for now <br/>Check it
                        back later :(
                    </p>
                </div>
            )}
        </div>
    );
};

export default CoursesPage;